"""Read-only full-corpus diagnostics and deterministic assisted-review dossiers."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import sqlite3


def lexical(morphology):
    if morphology.startswith("H"):
        parts = [p for p in morphology[1:].split("/") if not p.startswith("S")]
        return bool(parts) and parts[-1].startswith(("N", "V"))
    return morphology.startswith(("N-", "V-"))


def audit(root, edition):
    db = sqlite3.connect(f"file:{root}/generated/{edition}/bible-{edition}-strong.sqlite?mode=ro", uri=True)
    pools = defaultdict(list); reasons = Counter(); readings = Counter(); changes = Counter(); issues = []
    consistency = Counter()
    for ref, text, annotations, resolution, tokens in db.execute("SELECT ref,text,annotations_json,resolution_json,tokens_json FROM verses ORDER BY book_order,chapter,verse"):
        r = json.loads(resolution); annotations = json.loads(annotations); words = [w["text"] for w in json.loads(tokens)]
        reader = [a for a in annotations if a["visibility"] == "reader"]
        for field in ["changes", "inheritedChanges"]:
            changes.update(c["rule"] for c in r["concordance"][field])
        if r["issues"] or not r["decisions"]:
            issues.append({"ref": ref, "text": text, "issues": r["issues"], "units": len(r["decisions"])})
        for index, unit in enumerate(r["decisions"]):
            owned = [a for a in reader if a.get("originalOccurrenceId") in unit["occurrenceIds"]]
            if unit["state"] == "unresolved":
                reasons.update(unit["reasons"])
                readings[unit["source"].get("readingAssessment", {}).get("classification", "unknown")] += 1
            elif unit["state"] == "visible":
                consistency["visibleWithoutReader"] += not bool(owned)
                consistency["visibleWithRemainingReason"] += unit["exploration"]["remainingReason"] is not None
            categories = []
            if unit["assurance"] == "source-cardinal-with-local-noun": categories.append("numeric")
            if lexical(unit["source"]["morphology"]):
                if unit["state"] == "unresolved": categories.append("unresolved")
                elif unit["state"] == "visible":
                    if unit["source"].get("readingAssessment", {}).get("classification") == "minor-same-lexeme": categories.append("minor-reading")
                    if any(sum(code in u["strong"] for u in r["decisions"]) > 1 for code in unit["strong"]): categories.append("repeated-source")
            if not categories: continue
            carriers = []
            for a in owned:
                start = a.get("wordIndex", a.get("startWordIndex")); end = a.get("endWordIndex", start)
                carriers.append({"annotationId": a["id"], "kind": a["placement"], "start": start, "end": end,
                                 "text": " ".join(words[start:end+1]) if start is not None else "", "reason": a["reason"]})
            item = {"ref": ref, "text": text, "sourceUnitId": unit["sourceUnitId"], "source": unit["source"], "strong": unit["strong"],
                    "state": unit["state"], "assurance": unit["assurance"], "reasons": unit["reasons"], "carriers": carriers,
                    "sourceNeighbors": [{"id": u["sourceUnitId"], "gloss": u["source"]["gloss"], "strong": u["strong"], "target": u["targetWordIndices"]}
                                        for u in r["decisions"][max(0,index-2):index+3]]}
            rank = hashlib.sha256((edition + ":candidate-audit-v1:" + unit["sourceUnitId"]).encode()).hexdigest()
            for category in categories:
                pools[("AT" if unit["strong"][0].startswith("H") else "NT") + ":" + category].append((rank, item))
    db.close()
    samples = []
    for stratum, pool in sorted(pools.items()):
        seen = set()
        for _, item in sorted(pool):
            if item["ref"] in seen: continue
            samples.append({"stratum": stratum, **item}); seen.add(item["ref"])
            if len(seen) == 2: break
    result = {"edition": edition, "unresolvedReasons": reasons.most_common(), "unresolvedReadingClassifications": dict(readings),
              "consistency": dict(consistency), "changes": dict(changes), "issues": issues,
              "samplePopulationSizes": {k: len(v) for k,v in pools.items()}, "samples": samples,
              "reviewStatus": "dossiers-for-assisted-review-not-independent-labels"}
    file = root / "audit" / edition / "analysis.json"
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"edition": edition, "samples": len(samples), "consistency": dict(consistency), "changes": dict(changes)}))


if __name__ == "__main__":
    p = argparse.ArgumentParser(); p.add_argument("root", type=Path); p.add_argument("edition", choices=["s21","neg79"])
    a = p.parse_args(); audit(a.root.resolve(), a.edition)
