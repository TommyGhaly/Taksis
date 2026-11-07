"""
audit.py - Audit trail for the deacon schedule.

Everything that happens to a week ends up in
`churches/{churchId}/scheduleAudit`, one document per change. Two writers
contribute to each entry:

- The Firestore trigger (`audit_schedule_write` in main.py) sees every write to
  `churches/{churchId}/schedule/{weekId}`, whoever made it, and records what
  moved: who left or entered which role and whose availability status changed.
  It cannot tell who made the change.
- The endpoint that made the change records who did it, what they meant to do,
  and what we knew at that moment - each affected person's status, whether they
  had declared themselves away for the week, any open unavailability request.

Both key the entry by the schedule write's commit time, so they merge into one
document whichever lands first. A write no endpoint claims - someone answering
Confirmed / Unsure from the app, an edit in the console - keeps only the
trigger's half, with an inferred action and actor.

Things that never touch a schedule document (an admin's "please confirm"
reminder) go through `record_event` instead and get an ordinary auto id.

Every function here is best-effort. The schedule change has already been
committed by the time it is audited, and a failure to log it must never turn a
successful admin action into an error.

Adding or removing an altar server re-slices every week's altar
(`update_future_schedules`). Those follow-on weeks still get an entry each -
the trigger writes one regardless, and each week's own History needs it - but
the endpoint stamps them with `parent`, the id of the add/remove entry that
caused them, so church-wide views show one action instead of one per week.

Endpoints run their audit reads and writes on `in_background` so they overlap
the real work instead of adding to it. They still `settle` before returning:
once the response is sent Cloud Run throttles the CPU, and work left running
then can stall or be dropped.

Entry shape:
    week:           "MM-DD-YY", or None for a church-wide event
    at:             commit time of the schedule write (or server time)
    action:         what the endpoint did, e.g. "switch_server"
    summary:        one human-readable sentence
    actor:          {uid, name, kind}  kind is admin | user | system | unknown
    affected:       [{uid, name, role, status, declaredUnavailable,
                      unavailableRequest}] as they stood *before* the action
    details:        action-specific extras
    changes:        [{uid, name, from, to, statusBefore, statusAfter}]
                    from the trigger; role None means not on the sheet at all,
                    "extra" means in the pool but not serving
    inferredAction: the trigger's best guess when no endpoint claimed the write
    inferredActor:  likewise
    parent:         on a follow-on week, the entry id of the action behind it
"""
import datetime
import logging
from concurrent.futures import Future, ThreadPoolExecutor, wait
from typing import Any, Dict, List, Optional

from google.cloud import firestore

AUDIT_COLLECTION = "scheduleAudit"

SYSTEM_ACTOR = {"uid": None, "name": "Automatic", "kind": "system"}
UNKNOWN_ACTOR = {"uid": None, "name": "Unknown", "kind": "unknown"}


# ============================================================================
# HELPERS
# ============================================================================

_POOL = ThreadPoolExecutor(max_workers=8, thread_name_prefix="audit")


def in_background(fn, *args, **kwargs) -> Future:
    """Run audit work alongside the endpoint's own. Exceptions are logged and
    the future resolves to None, so `.result()` never raises."""
    def run():
        try:
            return fn(*args, **kwargs)
        except Exception:
            logging.exception("audit: background %s failed", getattr(fn, "__name__", fn))
            return None
    return _POOL.submit(run)


def settle(*futures: Optional[Future], timeout: float = 20) -> None:
    """Wait for background audit work before the response goes out."""
    pending = [f for f in futures if f is not None]
    if pending:
        wait(pending, timeout=timeout)

def _audit_ref(client, church_id):
    return (
        client.collection("churches")
        .document(church_id)
        .collection(AUDIT_COLLECTION)
    )


def _as_datetime(commit_time) -> Optional[datetime.datetime]:
    """Commit times arrive as datetimes from the client library and as protobuf
    Timestamps from some trigger payloads. Normalise to an aware datetime."""
    if commit_time is None:
        return None
    if isinstance(commit_time, datetime.datetime):
        return commit_time
    if hasattr(commit_time, "ToDatetime"):
        return commit_time.ToDatetime(tzinfo=datetime.timezone.utc)
    return None


def _commit_nanos(commit_time) -> Optional[int]:
    """Nanoseconds since the epoch, exact on both sides of the merge.

    The trigger and the endpoint have to arrive at the same document id from
    their own copy of the commit time, so this cannot go through a float.
    """
    if commit_time is None:
        return None
    if hasattr(commit_time, "seconds") and hasattr(commit_time, "nanos"):
        return commit_time.seconds * 1_000_000_000 + commit_time.nanos
    if isinstance(commit_time, datetime.datetime):
        aware = commit_time if commit_time.tzinfo else commit_time.replace(tzinfo=datetime.timezone.utc)
        whole = aware.replace(microsecond=0)
        seconds = int((whole - datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)).total_seconds())
        nanos = getattr(commit_time, "nanosecond", None) or commit_time.microsecond * 1000
        return seconds * 1_000_000_000 + nanos
    return None


def entry_id(week_id: str, commit_time) -> Optional[str]:
    nanos = _commit_nanos(commit_time)
    if nanos is None:
        return None
    return f"{week_id}_{nanos}"


def _is_person(entry) -> bool:
    # Vacated and unfilled slots hold `{name: "N/A", uid: <uuid>}`; those uuids
    # are not people and would show up as phantom arrivals and departures.
    return isinstance(entry, dict) and bool(entry.get("uid")) and entry.get("name") != "N/A"


def locations(schedule_data: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """uid -> {role, name, status} for everyone on a week's sheet."""
    found = {}
    for key, value in (schedule_data or {}).items():
        slots = value if isinstance(value, list) else [value]
        for slot in slots:
            if _is_person(slot) and slot["uid"] not in found:
                found[slot["uid"]] = {
                    "role": key,
                    "name": slot.get("name"),
                    "status": slot.get("status"),
                }
    return found


# ============================================================================
# ACTORS
# ============================================================================

def actor_from_token(decoded_token: Optional[Dict[str, Any]], client=None) -> Dict[str, Any]:
    """Who made the request, from the already-verified ID token.

    The endpoints only verify a token when one is sent, so None is possible and
    is recorded as such rather than guessed at.
    """
    if not decoded_token or not decoded_token.get("uid"):
        return dict(UNKNOWN_ACTOR)
    uid = decoded_token["uid"]
    name = decoded_token.get("name") or decoded_token.get("email")
    kind = "user"
    try:
        client = client or firestore.Client()
        user_doc = client.collection("users").document(uid).get()
        if user_doc.exists:
            data = user_doc.to_dict() or {}
            name = data.get("name") or name
            if data.get("admin"):
                kind = "admin"
    except Exception:
        logging.exception("audit: could not look up actor %s", uid)
    return {"uid": uid, "name": name or uid, "kind": kind}


# ============================================================================
# CONTEXT AT THE MOMENT OF AN ACTION
# ============================================================================

def people_context(client, church_id: str, week_id: str,
                   schedule_data: Optional[Dict[str, Any]],
                   people: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Where each person stood just before an action, and what they had told us.

    `people` are slot dicts ({uid, name}); `schedule_data` must be the week as
    it was *before* the action was applied.
    """
    people = [p for p in people if _is_person(p)]
    if not people:
        return []

    on_sheet = locations(schedule_data)

    # Open "I can't make it" requests for the week, keyed by the person who
    # asked. Same shape `unavailable()` writes: role -> {original, replacement},
    # or for altar role -> index -> {original, replacement}.
    requests = {}
    try:
        unavailable_doc = (
            client.collection("churches").document(church_id)
            .collection("unavailable").document(week_id).get()
        )
        for role, value in ((unavailable_doc.to_dict() or {}) if unavailable_doc.exists else {}).items():
            entries = [value] if "original" in (value or {}) else list((value or {}).values())
            for entry in entries:
                original = (entry or {}).get("original") or {}
                if original.get("uid"):
                    requests[original["uid"]] = {
                        "role": role,
                        "suggestedReplacement": (entry or {}).get("replacement"),
                    }
    except Exception:
        logging.exception("audit: could not read unavailable/%s", week_id)

    # `users/{uid}.unavailableWeeks` - weeks people declared ahead of time.
    # Children have no user document, so they simply never match.
    declared = set()
    try:
        refs = [client.collection("users").document(p["uid"]) for p in people]
        for doc in client.get_all(refs):
            if doc.exists and week_id in ((doc.to_dict() or {}).get("unavailableWeeks") or []):
                declared.add(doc.id)
    except Exception:
        logging.exception("audit: could not read unavailableWeeks")

    context = []
    for person in people:
        uid = person["uid"]
        where = on_sheet.get(uid) or {}
        context.append({
            "uid": uid,
            "name": where.get("name") or person.get("name"),
            "role": where.get("role"),
            "status": where.get("status"),
            "declaredUnavailable": uid in declared,
            "unavailableRequest": requests.get(uid),
        })
    return context


# ============================================================================
# WRITERS
# ============================================================================

def record_action(church_id: str, week_id: str, commit_time, action: str,
                  actor: Dict[str, Any], summary: str,
                  affected: List[Dict[str, Any]] = None,
                  details: Dict[str, Any] = None, client=None) -> None:
    """The endpoint's half of an entry, merged onto the trigger's by commit time."""
    try:
        client = client or firestore.Client()
        data = {
            "week": week_id,
            "at": _as_datetime(commit_time) or firestore.SERVER_TIMESTAMP,
            "action": action,
            "actor": actor or dict(UNKNOWN_ACTOR),
            "summary": summary,
            "affected": affected or [],
            "details": details or {},
        }
        doc_id = entry_id(week_id, commit_time)
        ref = _audit_ref(client, church_id)
        (ref.document(doc_id) if doc_id else ref.document()).set(data, merge=True)
    except Exception:
        logging.exception("audit: failed to record %s for %s/%s", action, church_id, week_id)


def record_event(church_id: str, week_id: Optional[str], action: str,
                 actor: Dict[str, Any], summary: str,
                 affected: List[Dict[str, Any]] = None,
                 details: Dict[str, Any] = None, client=None) -> None:
    """An action that wrote nothing to a schedule document."""
    try:
        client = client or firestore.Client()
        _audit_ref(client, church_id).document().set({
            "week": week_id,
            "at": firestore.SERVER_TIMESTAMP,
            "action": action,
            "actor": actor or dict(UNKNOWN_ACTOR),
            "summary": summary,
            "affected": affected or [],
            "details": details or {},
        })
    except Exception:
        logging.exception("audit: failed to record %s for %s", action, church_id)


def record_rebalance(church_id: str, rebalance: Optional[Dict[str, Any]],
                     actor: Dict[str, Any], cause: str,
                     parent_id: Optional[str], client=None) -> None:
    """The endpoint's half for every week `update_future_schedules` re-sliced,
    in one batch, each pointing at the entry for the action that caused it.

    `rebalance` is what `update_future_schedules` returns.
    """
    rebalanced = (rebalance or {}).get("weeks") or []
    if not rebalanced:
        return
    altar_servers = rebalance.get("altarServers")
    try:
        client = client or firestore.Client()
        ref = _audit_ref(client, church_id)
        batch = client.batch()
        for item in rebalanced:
            doc_id = entry_id(item["week"], item["commit_time"])
            batch.set(ref.document(doc_id) if doc_id else ref.document(), {
                "week": item["week"],
                "at": _as_datetime(item["commit_time"]) or firestore.SERVER_TIMESTAMP,
                "action": "rebalance",
                "actor": actor or dict(UNKNOWN_ACTOR),
                "summary": f"Altar resized to {altar_servers} after {cause or 'an edit'}",
                "affected": [],
                "details": {"cause": cause, "altarServers": altar_servers},
                "parent": parent_id,
            }, merge=True)
        batch.commit()
    except Exception:
        logging.exception("audit: failed to record rebalance for %s", church_id)


# ============================================================================
# THE TRIGGER'S HALF
# ============================================================================

def diff_schedule(before: Optional[Dict[str, Any]],
                  after: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Who moved between roles, and whose status changed, between two versions.

    Person-centric on purpose: an altar index shifting because someone above
    left is not a change to anyone. Reordering within the extra pool is not
    either.

    A freshly created week lists its lineup; the extra pool is left out there,
    since everybody not serving lands in it and that is not news.
    """
    old, new = locations(before), locations(after)
    creating = before is None
    changes = []
    for uid in list(old) + [u for u in new if u not in old]:
        was, now = old.get(uid) or {}, new.get(uid) or {}
        role_before, role_after = was.get("role"), now.get("role")
        status_before, status_after = was.get("status"), now.get("status")
        if creating and role_after in (None, "extra"):
            continue
        if role_before == role_after and status_before == status_after:
            continue
        changes.append({
            "uid": uid,
            "name": now.get("name") or was.get("name"),
            "from": role_before,
            "to": role_after,
            "statusBefore": status_before,
            "statusAfter": status_after,
        })
    return changes


def infer_action(before, after, changes):
    """Best guess at what happened when no endpoint claims the write."""
    if before is None:
        return "schedule_created", dict(SYSTEM_ACTOR)
    status_only = changes and all(c["from"] == c["to"] for c in changes)
    if status_only:
        if len(changes) == 1:
            # The app writes a status only for the person in the slot, so this
            # is them - or, for a child, their parent.
            change = changes[0]
            return "availability_response", {
                "uid": change["uid"],
                "name": change["name"],
                "kind": "self",
                "inferred": True,
            }
        return "availability_response", dict(UNKNOWN_ACTOR)
    return "schedule_changed", dict(UNKNOWN_ACTOR)


def record_schedule_write(church_id: str, week_id: str,
                          before: Optional[Dict[str, Any]],
                          after: Optional[Dict[str, Any]],
                          commit_time, client=None) -> None:
    try:
        client = client or firestore.Client()
        ref = _audit_ref(client, church_id)

        if after is None:
            # Weekly archiving. The lineup is in `archive/{weekId}`; listing
            # everybody as having left would bury the real entries.
            ref.document().set({
                "week": week_id,
                "at": firestore.SERVER_TIMESTAMP,
                "changes": [],
                "inferredAction": "schedule_archived",
                "inferredActor": dict(SYSTEM_ACTOR),
            })
            return

        changes = diff_schedule(before, after)
        if not changes and before is not None:
            # A write that moved nobody: a rename, or `update_future_schedules`
            # rewriting a week it left as it was. Any endpoint half for it
            # still stands on its own.
            return

        action, actor = infer_action(before, after, changes)
        doc_id = entry_id(week_id, commit_time)
        (ref.document(doc_id) if doc_id else ref.document()).set({
            "week": week_id,
            "at": _as_datetime(commit_time) or firestore.SERVER_TIMESTAMP,
            "changes": changes,
            "inferredAction": action,
            "inferredActor": actor,
        }, merge=True)
    except Exception:
        logging.exception("audit: trigger failed for %s/%s", church_id, week_id)
