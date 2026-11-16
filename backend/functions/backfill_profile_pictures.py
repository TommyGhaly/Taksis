#!/usr/bin/env python3
"""
backfill_profile_pictures.py - shrink existing profile photos in place

Profile photos used to be uploaded at camera resolution (up to ~4300px, ~1.2MB
each) to `profilePictures/{uid}.png`. Every avatar on every roster downloaded
and disk-cached that full file. New uploads are resized on the device (see
components/photoInput.js); this script brings the existing objects down to the
same size.

For each object whose longest side is over --max-side (default 512):

  1. A server-side copy of the original goes to `profilePicturesBackup/` (skip
     with --no-backup). Restoring is a copy back.
  2. The object is re-encoded at --max-side, honouring EXIF orientation, and
     written to the SAME path with the SAME content type, cache-control and
     custom metadata. Keeping `firebaseStorageDownloadTokens` is what keeps
     every download URL already stored in Firestore and on devices working.
     The write is conditional on the object's generation, so a user who
     re-uploads mid-run is never overwritten.
  3. `photoUpdatedAt` is bumped on every doc that points at the photo
     (users/{uid}, .../students/{id}, churches/{c}/ManualPeople/{id}). The URL
     doesn't change, so without a new version token devices keep serving the
     old full-size bytes out of expo-image's disk cache, whose key is the
     `?v=` URL built by utils/avatarCache.js uriFor(). A users/{uid} doc that
     never had `photoURL` gets one, so its avatar stops depending on the
     version-less Storage fallback.

Encoding follows the stored content type, so the file matches its label:
image/jpeg -> JPEG; image/png -> PNG (re-encoded from a photo it is far bigger
than the JPEG would be; --png-as-jpeg writes JPEG bytes and relabels the
object image/jpeg instead, which every client decodes by sniffing anyway).

Usage:
  python backfill_profile_pictures.py --dry-run     # survey, write nothing
  python backfill_profile_pictures.py               # do it
  python backfill_profile_pictures.py --limit 3     # try a few first

Safe to re-run: objects already within --max-side are skipped.
Requires firebase_admin.json in this directory.
"""

import argparse
import io
import sys
import time
from collections import Counter
from urllib.parse import quote

import firebase_admin
from firebase_admin import credentials, firestore, storage
from google.api_core import exceptions as gexc
from PIL import Image, ImageOps

CREDENTIALS_PATH = "firebase_admin.json"
BUCKET = "taksis-a8ba7.appspot.com"
PREFIX = "profilePictures/"
BACKUP_PREFIX = "profilePicturesBackup/"
HEADER_BYTES = 256 * 1024
JPEG_QUALITY = 82


def log(message=""):
    print(message)
    sys.stdout.flush()


def mb(n):
    return f"{n / 1_048_576:.1f}MB"


def kb(n):
    return f"{n / 1024:.0f}KB"


def sniff_size(blob):
    """(format, w, h) from the object's header, falling back to a full read."""
    for full in (False, True):
        try:
            data = blob.download_as_bytes() if full else blob.download_as_bytes(start=0, end=HEADER_BYTES - 1)
            with Image.open(io.BytesIO(data)) as im:
                w, h = im.size
                # Orientations 5-8 rotate by 90 degrees: displayed w/h swap.
                if im.getexif().get(0x0112, 1) in (5, 6, 7, 8):
                    w, h = h, w
                return im.format, w, h
        except Exception:
            continue
    return None, 0, 0


def encode(data, max_side, out_format):
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        im.thumbnail((max_side, max_side), Image.LANCZOS)
        buf = io.BytesIO()
        if out_format == "JPEG":
            if im.mode not in ("RGB", "L"):
                bg = Image.new("RGB", im.size, (255, 255, 255))
                rgba = im.convert("RGBA")
                bg.paste(rgba, mask=rgba.split()[-1])
                im = bg
            im.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        else:
            im.save(buf, "PNG", optimize=True)
        return buf.getvalue(), im.size


def choose_format(content_type, sniffed, png_as_jpeg):
    """(PIL format, content type) to write. Bytes always match the label."""
    if content_type == "image/png" and not png_as_jpeg:
        return "PNG", "image/png"
    if content_type in ("image/png", "image/jpeg") or sniffed == "JPEG":
        return "JPEG", "image/jpeg"
    return sniffed, content_type


def download_url(name, token):
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/"
        f"{quote(name, safe='')}?alt=media&token={token}"
    )


def index_photo_refs(db):
    """object name -> [DocumentReference] for every doc whose photoURL names it."""
    by_object = {}
    sources = [
        ("users", db.collection("users")),
        ("students", db.collection_group("students")),
        ("ManualPeople", db.collection_group("ManualPeople")),
    ]
    for label, query in sources:
        n = 0
        for snap in query.select(["photoURL"]).stream():
            url = (snap.to_dict() or {}).get("photoURL")
            if not isinstance(url, str) or "/o/" not in url:
                continue
            encoded = url.split("/o/", 1)[1].split("?", 1)[0]
            name = encoded.replace("%2F", "/").replace("%2f", "/")
            by_object.setdefault(name, []).append(snap.reference)
            n += 1
        log(f"  {label}: {n} docs with photoURL")
    return by_object


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    ap.add_argument("--max-side", type=int, default=512)
    ap.add_argument("--limit", type=int, default=0, help="process at most N oversized objects")
    ap.add_argument("--no-backup", action="store_true", help="skip copying originals to " + BACKUP_PREFIX)
    ap.add_argument("--png-as-jpeg", action="store_true", help="re-encode image/png objects as JPEG and relabel them")
    args = ap.parse_args()

    firebase_admin.initialize_app(credentials.Certificate(CREDENTIALS_PATH), {"storageBucket": BUCKET})
    bucket = storage.bucket()
    db = firestore.client()

    log(f"{'DRY RUN - ' if args.dry_run else ''}bucket {BUCKET}, prefix {PREFIX}, max side {args.max_side}px")
    log("Indexing Firestore photoURL fields...")
    refs_by_object = index_photo_refs(db)

    blobs = [b for b in bucket.list_blobs(prefix=PREFIX) if not b.name.endswith("/")]
    log(f"\n{len(blobs)} objects under {PREFIX}\n")

    types, formats, mismatched = Counter(), Counter(), []
    oversized, small, unreadable = [], [], []
    for blob in blobs:
        fmt, w, h = sniff_size(blob)
        types[blob.content_type] += 1
        formats[fmt] += 1
        label_fmt = {"image/jpeg": "JPEG", "image/png": "PNG"}.get(blob.content_type)
        if fmt and label_fmt and fmt != label_fmt:
            mismatched.append(blob.name)
        if not fmt:
            unreadable.append(blob)
        elif max(w, h) > args.max_side:
            oversized.append((blob, fmt, w, h))
        else:
            small.append(blob)

    total = sum(b.size for b in blobs)
    over_bytes = sum(b.size for b, *_ in oversized)
    log(f"content types:  {dict(types)}")
    log(f"actual formats: {dict(formats)}")
    if mismatched:
        log(f"label != bytes: {len(mismatched)} objects (e.g. {mismatched[0]})")
    log(f"total size:     {mb(total)}  (avg {kb(total / max(len(blobs), 1))})")
    log(f"already <= {args.max_side}px: {len(small)}")
    log(f"unreadable:     {len(unreadable)}" + (f"  e.g. {unreadable[0].name}" if unreadable else ""))
    log(f"oversized:      {len(oversized)}  ({mb(over_bytes)})")
    if oversized:
        sides = sorted(max(w, h) for _, _, w, h in oversized)
        log(f"  longest side: min {sides[0]}, median {sides[len(sides) // 2]}, max {sides[-1]}")
        biggest = sorted(oversized, key=lambda t: -t[0].size)[:5]
        for b, fmt, w, h in biggest:
            log(f"  {b.name}  {w}x{h} {fmt} {kb(b.size)}")

    todo = oversized[: args.limit] if args.limit else oversized
    no_doc = [b.name for b, *_ in todo if b.name not in refs_by_object]
    log(f"\nversion bumps:  {sum(len(refs_by_object.get(b.name, [])) for b, *_ in todo)} docs"
        f"  ({len(no_doc)} photos referenced by no photoURL; their users/{{uid}} doc gets one if it exists)")

    # Estimate the result by actually encoding a sample.
    sample = todo[:5]
    if sample:
        before = after = 0
        for blob, fmt, _, _ in sample:
            out_fmt, _ = choose_format(blob.content_type, fmt, args.png_as_jpeg)
            data = blob.download_as_bytes()
            out, _ = encode(data, args.max_side, out_fmt)
            before += len(data)
            after += len(out)
        ratio = after / before
        log(f"sample encode:  {len(sample)} photos {kb(before)} -> {kb(after)} ({ratio:.1%}); "
            f"projected {mb(over_bytes)} -> ~{mb(over_bytes * ratio)}")

    if args.dry_run or not todo:
        log("\nNothing written." if args.dry_run else "\nNothing to do.")
        return

    log(f"\nShrinking {len(todo)} objects...")
    done = failed = raced = 0
    saved = 0
    for blob, fmt, w, h in todo:
        try:
            blob.reload()
            generation = blob.generation
            data = blob.download_as_bytes(if_generation_match=generation)
            out_fmt, new_type = choose_format(blob.content_type, fmt, args.png_as_jpeg)

            out, size = encode(data, args.max_side, out_fmt)
            if len(out) >= len(data):
                log(f"  skip {blob.name}: re-encode not smaller ({kb(len(data))} -> {kb(len(out))})")
                continue

            if not args.no_backup:
                bucket.copy_blob(blob, bucket, BACKUP_PREFIX + blob.name[len(PREFIX):],
                                 if_source_generation_match=generation)

            metadata = dict(blob.metadata or {})
            token = (metadata.get("firebaseStorageDownloadTokens") or "").split(",")[0]
            new = bucket.blob(blob.name)
            new.metadata = metadata
            new.cache_control = blob.cache_control
            new.content_disposition = blob.content_disposition
            new.upload_from_string(out, content_type=new_type, if_generation_match=generation)

            version = str(int(time.time() * 1000))
            refs = refs_by_object.get(blob.name, [])
            for r in refs:
                r.update({"photoUpdatedAt": version})
            uid = blob.name[len(PREFIX):].rsplit(".", 1)[0]
            if not refs and token:
                user_ref = db.collection("users").document(uid)
                if user_ref.get().exists:
                    user_ref.update({"photoURL": download_url(blob.name, token), "photoUpdatedAt": version})
                    refs = [user_ref]

            done += 1
            saved += len(data) - len(out)
            log(f"  {blob.name}: {w}x{h} {kb(len(data))} -> {size[0]}x{size[1]} {kb(len(out))}"
                f"  [{len(refs)} doc(s) bumped]")
        except gexc.PreconditionFailed:
            raced += 1
            log(f"  skip {blob.name}: changed during the run (user re-uploaded)")
        except Exception as e:
            failed += 1
            log(f"  FAILED {blob.name}: {e}")

    log(f"\nDone: {done} shrunk, {raced} skipped (re-uploaded mid-run), {failed} failed; saved {mb(saved)}.")


if __name__ == "__main__":
    main()
