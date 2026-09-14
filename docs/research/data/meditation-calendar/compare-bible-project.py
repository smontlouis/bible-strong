"""Compare bundled and downloaded Bible Project identities without copying source prose."""
import hashlib
import json
from pathlib import Path
import sys

source_root = Path(sys.argv[1])
repository = Path(__file__).resolve().parents[4]


def differences(left, right, path=""):
    if isinstance(left, dict) and isinstance(right, dict):
        return [p for key in sorted(left.keys() | right.keys())
                for p in differences(left.get(key), right.get(key), f"{path}/{key}")]
    if isinstance(left, list) and isinstance(right, list) and len(left) == len(right):
        return [p for index, (a, b) in enumerate(zip(left, right))
                for p in differences(a, b, f"{path}/{index}")]
    return [] if left == right else [path]


results = []
for content_id in ["bible-project-plan", "bible-project-plan-en"]:
    local = repository / "apps/expo/src/assets/plans" / f"{content_id}.txt"
    remote = source_root / f"{content_id}.json"
    a, b = json.loads(local.read_text()), json.loads(remote.read_text())
    ar = [r for section in a["sections"] for r in section["readingSlices"]]
    br = [r for section in b["sections"] for r in section["readingSlices"]]
    am, bm = {r["id"]: r for r in ar}, {r["id"]: r for r in br}
    changes = {key: differences(am[key], bm[key]) for key in sorted(am.keys() & bm.keys())
               if am[key] != bm[key]}
    results.append({
        "id": content_id, "localEntries": len(ar), "remoteEntries": len(br),
        "orderedIdsEqual": [r["id"] for r in ar] == [r["id"] for r in br],
        "missingRemoteIds": sorted(am.keys() - bm.keys()),
        "missingLocalIds": sorted(bm.keys() - am.keys()),
        "changedFields": changes,
        "localSha256": hashlib.sha256(local.read_bytes()).hexdigest(),
        "remoteSha256": hashlib.sha256(remote.read_bytes()).hexdigest(),
        "localLastUpdate": a.get("lastUpdate"), "remoteLastUpdate": b.get("lastUpdate"),
    })
print(json.dumps(results, indent=2))
