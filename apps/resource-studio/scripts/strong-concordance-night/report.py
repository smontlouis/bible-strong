"""Export all measured strata plus gained/lost exact carriers, without new inference."""
import argparse
from collections import Counter
import csv
import json
from pathlib import Path


def read(file):
    return json.loads(Path(file).read_text())


def carrier_key(ref, p):
    support = ("empty", p.get("insertAfterWordIndex")) if p["kind"] == "empty" else tuple(p.get("targetWordIndices", range(p["startWordIndex"], p["endWordIndex"] + 1)))
    return ref, p["strong"], support


def correct_carriers(root, edition, scenario, split, variant):
    name = f"{edition}-{scenario}-{split}"
    predictions = root / "baseline" / name if variant == "baseline" else root / "variants" / f"{name}-{variant}"
    counter = Counter(carrier_key(v["ref"], p) for v in read(predictions / "predictions.json") for p in v["placements"])
    for verse in read(root / "evaluation" / f"{name}-{variant}" / "verses.json"):
        for p in verse["unmatchedPredicted"]:
            counter[carrier_key(verse["ref"], p)] -= 1
    assert all(n >= 0 for n in counter.values())
    return +counter


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=Path("outputs/strong-concordance-night/final-v2"))
    root = p.parse_args().root
    read(root / "rule-freeze.json")
    summaries = [read(p) for p in sorted((root / "evaluation").glob("*/summary.json"))]
    flat = []
    for s in summaries:
        strata = [("total", "all", s["total"])] + [(group, label, value) for group in ["byTestament", "byGenre", "byDifficulty"] for label, value in s[group].items()]
        for group, label, value in strata:
            for measure, m in value["metrics"].items():
                flat.append({"edition": s["edition"], "scenario": s["scenario"], "split": s["split"], "variant": s["variant"],
                             "stratum": group, "label": label, "measure": measure, "verses": value["verses"], **m,
                             "sourceUnits": value["units"], "unresolved": value["unresolved"], "uncertaintyRate": value["uncertaintyRate"],
                             "fullyAccountedVerses": value["fullyAccountedVerses"], "identityComparableVerses": value["identityComparableVerses"],
                             "cardinalityError": value["cardinalityError"], "exactCardinalityVerses": value["exactCardinalityVerses"]})
    with (root / "all-metrics.tsv").open("w") as f:
        w = csv.DictWriter(f, fieldnames=flat[0].keys(), delimiter="\t")
        w.writeheader()
        w.writerows(flat)
    comparisons = []
    for s in summaries:
        if s["variant"] not in ["carriers-only", "combined"]:
            continue
        before = correct_carriers(root, s["edition"], s["scenario"], s["split"], "baseline")
        after = correct_carriers(root, s["edition"], s["scenario"], s["split"], s["variant"])
        lost, gained = before - after, after - before
        comparisons.append({"edition": s["edition"], "scenario": s["scenario"], "split": s["split"], "variant": s["variant"],
                            "lostExactCarriers": sum(lost.values()), "gainedExactCarriers": sum(gained.values()),
                            "lost": [{"ref": k[0], "strong": k[1], "support": k[2], "count": v} for k, v in sorted(lost.items(), key=str)],
                            "gained": [{"ref": k[0], "strong": k[1], "support": k[2], "count": v} for k, v in sorted(gained.items(), key=str)]})
    (root / "carrier-regressions.json").write_text(json.dumps(comparisons, ensure_ascii=False, indent=2) + "\n")
    lines = ["# Mesures de l’expérience gelée", "", "Accord éditorial avec les annotations masquées ; aucune certification sémantique indépendante.", "",
             "| Édition | Scénario | Ensemble | Variante | Versets | Exact P | Exact R | Exact F1 | Chevauchement F1 | Incertitude | Complets |", "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|"]
    for s in summaries:
        t = s["total"];m=t["metrics"]["exact"]
        lines.append(f'| {s["edition"]} | {s["scenario"]} | {s["split"]} | {s["variant"]} | {t["verses"]} | {m["precision"]:.4f} | {m["recall"]:.4f} | {m["f1"]:.4f} | {t["metrics"]["overlap"]["f1"]:.4f} | {t["uncertaintyRate"]:.4f} | {t["fullyAccountedVerses"]} |')
    (root / "resultats.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({"summaries": len(summaries), "metricRows": len(flat), "regressionComparisons": len(comparisons)}))


if __name__ == "__main__":
    main()
