"""Offline, reproducible preparation and full candidate generation (two editions only)."""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

STUDIO = Path(__file__).resolve().parents[2]


def sha(file):
    h = hashlib.sha256()
    with Path(file).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def save(file, data):
    file.parent.mkdir(parents=True, exist_ok=True)
    tmp = file.with_suffix(file.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(file)


def prepare(root):
    env = root / "environment"
    env.mkdir(parents=True, exist_ok=True)
    files = [*(STUDIO / "data/external/stepbible/amalgamated").glob("TAHOT*.txt"),
             *(STUDIO / "data/external/stepbible/amalgamated").glob("TAGNT*.txt"),
             *[STUDIO / f"data/strongs/{n}.csv" for n in ["Sg1910", "Darby", "DarbyR"]],
             *[STUDIO / f"data/bibles/bible-{n}.json" for n in ["neg79", "s21"]],
             *[STUDIO / f"data/external/stepbible/{n}.txt" for n in ["TBESH", "TBESG"]]]
    hashes = {}
    for source in files:
        relative = source.relative_to(STUDIO)
        dest = env / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copyfile(source, dest)
        assert sha(source) == sha(dest), f"input-drift:{relative}"
        hashes[str(relative)] = sha(dest)
    for ed in ["neg79", "s21"]:
        data = json.loads((env / f"data/bibles/bible-{ed}.json").read_text())
        assert len(data) == 66
        for chapters in data.values():
            for verses in chapters.values():
                for text in verses.values():
                    assert isinstance(text, str) and not any(x in text for x in ["<", "data-pa", "◎"]), "annotated-target-input"
    dictionary = env / "empty-dictionary.sqlite"
    if not dictionary.exists():
        # Same validated neutral fixture as the experiment; no lexical candidates.
        import sqlite3
        with sqlite3.connect(dictionary) as db:
            db.executescript("""CREATE TABLE StepEntries(id INTEGER, eStrong TEXT, dStrong TEXT, uStrong TEXT, morph TEXT);
            CREATE TABLE LexiconTranslations(stepEntryId INTEGER, language TEXT, gloss TEXT, meaning TEXT);
            INSERT INTO StepEntries VALUES(1,'','','','');
            INSERT INTO LexiconTranslations VALUES(1,'fr','.','.');""")
    hashes[dictionary.name] = sha(dictionary)
    for name in ["src", "scripts", "node_modules"]:
        if not (env / name).exists():
            (env / name).symlink_to(STUDIO / name, target_is_directory=True)
    save(root / "input-manifest.json", {"files": hashes, "references": ["Sg1910", "Darby", "DarbyR"],
         "targetAnnotations": False, "remoteModels": False, "dictionaryCandidates": 0})


def node(root, script, args, log, cwd=None):
    code = root / "code" if (root / "code/manifest.json").exists() else STUDIO
    print(f"{script} {' '.join(map(str, args))}", flush=True)
    with (root / log).open("w") as output:
        subprocess.run(["node", "--max-old-space-size=16384", "--import", "tsx", str(code / script), *map(str, args)],
                       cwd=cwd or STUDIO, env={**os.environ, "STRONG_PERF": "1"}, stdout=output, stderr=subprocess.STDOUT, check=True)


def freeze(root):
    code = root / "code"
    assert not code.exists(), "use-a-new-root-for-a-new-code-freeze"
    for directory in ["src", "scripts"]:
        shutil.copytree(STUDIO / directory, code / directory, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    hashes = {str(f.relative_to(code)): sha(f) for f in sorted(code.rglob("*")) if f.is_file()}
    (code / "node_modules").symlink_to(STUDIO / "node_modules", target_is_directory=True)
    save(code / "manifest.json", {"files": hashes, "inputManifestSha256": sha(root / "input-manifest.json"),
         "correspondence": {ed: sha(root / f"correspondence/{ed}.json") for ed in ["neg79", "s21"] if (root / f"correspondence/{ed}.json").exists()}})
    for name in ["src", "scripts"]:
        link = root / "environment" / name
        assert link.is_symlink()
        link.unlink()
        link.symlink_to(code / name, target_is_directory=True)


def check_freeze(root):
    m = json.loads((root / "code/manifest.json").read_text())
    assert sha(root / "input-manifest.json") == m["inputManifestSha256"]
    for f, h in m["files"].items():
        assert sha(root / "code" / f) == h, f"frozen-code-drift:{f}"
    for ed, h in m["correspondence"].items():
        assert sha(root / f"correspondence/{ed}.json") == h


def integration(root, previous):
    scenarios = [("SG21", "target-excluded"), ("NEG", "target-excluded"), ("SG21", "family-excluded"),
                 ("NEG", "family-excluded"), ("Sg1910", "control-segond"), ("Darby", "control-darby"), ("DarbyR", "control-darby")]
    masked = root / "environment/masked"
    masked.mkdir(exist_ok=True)
    for f in (previous / "masked").glob("*-test.bible.json"):
        shutil.copyfile(f, masked / f.name)
    results = []
    for ed, scenario in scenarios:
        node(root, "scripts/strong-candidates/predict.ts", [root, ed, scenario], f"integration-{ed}-{scenario}.log")
        old = json.loads((previous / f"followup/{ed}-{scenario}-test-display-adapted/predictions.json").read_text())
        new = json.loads((root / f"integration/{ed}-{scenario}/predictions.json").read_text())
        assert [v["ref"] for v in new] == [v["ref"] for v in old]
        def carriers(v):
            return Counter((p.get("originalOccurrenceId"), p["strong"], p["kind"], p.get("startWordIndex"), p.get("endWordIndex"), p.get("insertAfterWordIndex")) for p in v["placements"])
        def units(v):
            return [(u["sourceUnitId"], u["occurrenceIds"], u["strong"], u["state"], u["targetWordIndices"], u.get("anchor", {}).get("absenceEstablished", False)) for u in v["units"]]
        changes = [a["ref"] for a, b in zip(old, new) if carriers(a) != carriers(b) or units(a) != units(b) or a["text"] != b["text"]]
        results.append({"edition": ed, "scenario": scenario, "verses": len(new), "changedVerses": changes,
                        "oldSha256": sha(previous / f"followup/{ed}-{scenario}-test-display-adapted/predictions.json"),
                        "newSha256": sha(root / f"integration/{ed}-{scenario}/predictions.json")})
    save(root / "integration-verification.json", {"comparisons": results, "passed": not any(r["changedVerses"] for r in results),
         "claim": "integration parity on already consumed chapters, not a new independent quality estimate"})
    assert not any(r["changedVerses"] for r in results), "integration-policy-drift"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["prepare", "correspondence", "refine-correspondence", "integration", "freeze", "generate", "verify"])
    p.add_argument("--root", required=True, type=Path)
    p.add_argument("--edition", choices=["neg79", "s21"])
    p.add_argument("--previous", default=STUDIO / "outputs/strong-concordance-reading-groups", type=Path)
    a = p.parse_args(); root = a.root.resolve(); root.mkdir(parents=True, exist_ok=True)
    if a.command == "prepare": prepare(root)
    elif a.command == "integration": integration(root, a.previous.resolve())
    elif a.command == "freeze": freeze(root)
    else:
        for ed in [a.edition] if a.edition else ["neg79", "s21"]:
            if a.command == "correspondence":
                node(root, "src/generateVerseCorrespondence.ts", ["--bible", ed, "--input", f"data/bibles/bible-{ed}.json",
                     "--output", root / f"correspondence/{ed}.json", "--report", root / f"correspondence/{ed}-report.json"],
                     f"correspondence-{ed}.log", root / "environment")
            elif a.command == "refine-correspondence":
                assert not (root / "code").exists(), "refine-correspondence-before-freezing-code"
                original = root / f"correspondence/{ed}.json"
                refined = root / f"correspondence/{ed}-refined.json"
                node(root, "scripts/strong-candidates/audit-correspondence.ts", [root, ed, refined], f"refine-correspondence-{ed}.log")
                original.rename(root / f"correspondence/{ed}-detected.json")
                refined.rename(original)
            else:
                check_freeze(root)
                node(root, f"scripts/strong-candidates/{'predict' if a.command == 'generate' else 'verify'}.ts", [root, ed], f"{a.command}-{ed}.log")


if __name__ == "__main__":
    main()
