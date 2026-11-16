"""Local Firestore dashboard for Taksis (PROD data).

Run:  backend/functions/venv/bin/python scripts/db-dashboard/app.py
Open: http://127.0.0.1:5055

Binds to localhost only. Every write is logged to `_admin_audit`
in the same shape the app uses (action/before/after/path/uid/meta/ts).
"""
import datetime, json, os, re
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import DocumentReference, GeoPoint
from flask import Flask, jsonify, request, send_file

ROOT = os.path.dirname(os.path.abspath(__file__))
CRED = os.path.join(ROOT, "..", "..", "backend", "functions", "firebase_admin.json")
firebase_admin.initialize_app(credentials.Certificate(CRED))
db = firestore.client()
app = Flask(__name__)
EDITOR = "local-dashboard"

# ---- tagged JSON so timestamps/refs/geopoints survive a round trip ----
def enc(v):
    if isinstance(v, datetime.datetime): return {"__ts": v.isoformat()}
    if isinstance(v, DocumentReference): return {"__ref": v.path}
    if isinstance(v, GeoPoint): return {"__geo": [v.latitude, v.longitude]}
    if isinstance(v, bytes): return {"__bytes": v.hex()}
    if isinstance(v, dict): return {k: enc(x) for k, x in v.items()}
    if isinstance(v, list): return [enc(x) for x in v]
    return v

def dec(v):
    if isinstance(v, dict):
        if set(v) == {"__ts"}: return datetime.datetime.fromisoformat(v["__ts"])
        if set(v) == {"__ref"}: return db.document(v["__ref"])
        if set(v) == {"__geo"}: return GeoPoint(*v["__geo"])
        if set(v) == {"__bytes"}: return bytes.fromhex(v["__bytes"])
        return {k: dec(x) for k, x in v.items()}
    if isinstance(v, list): return [dec(x) for x in v]
    return v

def is_doc(path): return len([p for p in path.split("/") if p]) % 2 == 0

def audit(action, path, before, after, meta=None):
    db.collection("_admin_audit").add({
        "action": action, "path": path, "uid": EDITOR,
        "before": before, "after": after, "meta": meta or {"source": "db-dashboard"},
        "ts": firestore.SERVER_TIMESTAMP,
    })

@app.get("/")
def index(): return send_file(os.path.join(ROOT, "index.html"))

@app.get("/api/collections")
def collections():
    path = request.args.get("path", "").strip("/")
    cols = db.document(path).collections() if path else db.collections()
    return jsonify(sorted(c.id for c in cols))

@app.get("/api/docs")
def docs():
    path = request.args.get("path", "").strip("/")
    limit = min(int(request.args.get("limit", 50)), 500)
    q = db.collection(path)
    field, op, val = (request.args.get(k) for k in ("field", "op", "value"))
    if field and val is not None:
        try: parsed = json.loads(val)
        except ValueError: parsed = val
        q = q.where(filter=firestore.FieldFilter(field, op or "==", parsed))
    else:
        q = q.order_by("__name__")
        after = request.args.get("after")
        if after: q = q.start_after(db.collection(path).document(after).get())
    out = []
    for d in q.limit(limit).stream():
        data = d.to_dict() or {}
        label = next((str(data[k]) for k in ("name", "title", "email", "plate") if k in data), "")
        out.append({"id": d.id, "label": label, "fields": len(data)})
    if field and val is not None: out.sort(key=lambda x: x["id"])
    return jsonify(out)

@app.get("/api/doc")
def get_doc():
    path = request.args["path"].strip("/")
    snap = db.document(path).get()
    return jsonify({"exists": snap.exists, "data": enc(snap.to_dict() or {}),
                    "subcollections": sorted(c.id for c in db.document(path).collections())})

@app.put("/api/doc")
def put_doc():
    body = request.get_json()
    path = body["path"].strip("/")
    if not is_doc(path): return jsonify({"error": "not a document path"}), 400
    ref = db.document(path)
    before = ref.get().to_dict()
    after = dec(body["data"])
    ref.set(after)
    audit("update" if before is not None else "create", path, before, after)
    return jsonify({"ok": True})

@app.post("/api/doc")
def add_doc():
    body = request.get_json()
    col = body["collection"].strip("/")
    ref = db.collection(col).document(body["id"]) if body.get("id") else db.collection(col).document()
    if ref.get().exists: return jsonify({"error": "document already exists"}), 409
    data = dec(body.get("data", {}))
    ref.set(data)
    audit("create", ref.path, None, data)
    return jsonify({"ok": True, "path": ref.path})

@app.delete("/api/doc")
def del_doc():
    path = request.args["path"].strip("/")
    ref = db.document(path)
    before = ref.get().to_dict()
    ref.delete()  # subcollections are left in place, same as Firestore console
    audit("delete", path, before, None)
    return jsonify({"ok": True})

if __name__ == "__main__":
    print("Taksis DB dashboard → http://127.0.0.1:5055  (PRODUCTION data)")
    app.run(host="127.0.0.1", port=5055, debug=False)
