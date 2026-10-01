"""Reproducible offline experiment orchestration (no remote model invocation)."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile


CASES = [("SG21", "target-excluded"), ("SG21", "family-excluded"),
         ("NEG", "target-excluded"), ("NEG", "family-excluded"),
         ("Sg1910", "control-segond"), ("Darby", "control-darby"), ("DarbyR", "control-darby")]
VARIANTS = ["baseline", "numbers", "heads", "accountable", "carriers-only", "combined", "two-family-heads", "edition-adapted"]
BASE = "dec602f8db67f94476f7f50a4289de5c405640a1"
SCRIPTS = Path("scripts/strong-concordance-night")


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def dump(file, value):
    Path(file).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def ts(script, args, log):
    with Path(log).open("w") as out:
        subprocess.run(["yarn", "exec", "node", "--import", "tsx", str(SCRIPTS / script), *map(str, args)], stdout=out, stderr=subprocess.STDOUT, check=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("stage", choices=["init", "baseline", "development", "freeze", "test", "verify"])
    p.add_argument("--root", type=Path, default=Path("outputs/strong-concordance-night/final-v2"))
    p.add_argument("--cache", type=Path, help="Copy an already frozen acquisition directory during init.")
    args = p.parse_args()
    root = args.root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    if args.stage == "init":
        if (root / "plan.json").exists():
            raise ValueError("init-requires-new-root")
        shutil.copyfile(SCRIPTS / "plan.json", root / "plan.json")
        archive = root / "initial-code.tar"
        with archive.open("wb") as out:
            subprocess.run(["git", "archive", BASE, "apps/resource-studio"], cwd="../..", stdout=out, check=True)
        snapshot = root / "initial-code"
        snapshot.mkdir()
        with tarfile.open(archive) as tar:
            tar.extractall(snapshot, filter="data")
        if args.cache:
            shutil.copytree(args.cache, root / "acquisition")
        dump(root / "initial-state.json", {"commit": BASE, "planSha256": sha(root / "plan.json"), "codeArchiveSha256": sha(archive)})
        print("Initialized. Run acquire.py, then prepare.ts before baseline.")
    elif args.stage == "baseline":
        for split in ["development", "test"]:
            for edition, scenario in CASES:
                out = root / "baseline" / f"{edition}-{scenario}-{split}"
                if (out / "receipt.json").exists():
                    receipt = json.loads((out / "receipt.json").read_text())
                    assert receipt["predictionsSha256"] == sha(out / "predictions.json")
                    continue
                ts("baseline.ts", [root, edition, scenario, split], root / f"baseline-{edition}-{scenario}-{split}.log")
                print(edition, scenario, split, "sealed", flush=True)
    elif args.stage in {"development", "test"}:
        split = args.stage
        if split == "test":
            freeze = json.loads((root / "rule-freeze.json").read_text())
            for file, digest in freeze["code"].items():
                assert sha(file) == digest, f"rule-drift:{file}"
        for edition, scenario in CASES:
            for variant in VARIANTS:
                label = f"{split}-{edition}-{scenario}-{variant}"
                if variant != "baseline":
                    ts("refine.ts", [root, edition, scenario, split, variant], root / f"{label}-predict.log")
                ts("evaluate.ts", [root, edition, scenario, split, variant], root / f"{label}-evaluate.log")
            print(edition, scenario, split, "ablations verified", flush=True)
    elif args.stage == "freeze":
        file = root / "rule-freeze.json"
        if file.exists():
            raise ValueError("rules-already-frozen-do-not-retune-this-reserve")
        for edition, scenario in CASES:
            for variant in VARIANTS:
                assert (root / "evaluation" / f"{edition}-{scenario}-development-{variant}" / "summary.json").exists()
                if variant != "baseline":
                    receipt = json.loads((root / "variants" / f"{edition}-{scenario}-development-{variant}" / "receipt.json").read_text())
                    for source, digest in receipt["code"].items():
                        assert sha(source) == digest, f"development-prediction-code-drift:{source}"
        files = sorted([*Path("src").rglob("*.ts"), *SCRIPTS.glob("*.ts"), *SCRIPTS.glob("*.py"), SCRIPTS / "plan.json"])
        code = {str(f): sha(f) for f in files}
        dump(file, {"frozenAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "code": code,
                    "selectedPolicy": "combined", "evaluatedPolicies": VARIANTS,
                    "selectionReason": "Prioritize explicit source accountability, separate established absence/anchor and uncertainty. Accept the measured editorial recall cost; no optimization on reserved labels.",
                    "planSha256": sha(root / "plan.json"), "preparedInputsSha256": sha(root / "prepared-inputs.json"),
                    "reserveStatus": "target labels and errors not consulted; baseline predictions sealed before engine changes"})
        frozen = root / "frozen-code"
        for f in files:
            target = frozen / f
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(f, target)
        print("Frozen combined common policy. Test can now run.")
    elif args.stage == "verify":
        initial = json.loads((root / "initial-state.json").read_text())
        assert sha(root / "initial-code.tar") == initial["codeArchiveSha256"]
        with tarfile.open(root / "initial-code.tar") as tar:
            for member in tar:
                if member.isfile():
                    assert hashlib.sha256(tar.extractfile(member).read()).hexdigest() == sha(root / "initial-code" / member.name), f"baseline-code-drift:{member.name}"
        prepared = json.loads((root / "prepared-inputs.json").read_text())
        for file, digest in prepared["files"].items():
            assert sha(root / file) == digest, f"input-drift:{file}"
        # Integration leakage test: target annotation pages and evaluator gold
        # are unavailable for the entire fresh baseline prediction process.
        hidden = []
        replay_suffix = f"-blind-replay-{len(list((root / 'baseline').glob('SG21-target-excluded-development-blind-replay*'))) + 1}"
        try:
            for folder in ["evaluator-only", "acquisition"]:
                source = root / folder
                destination = root / f"{folder}.hidden-for-blind-replay"
                source.rename(destination)
                hidden.append((source, destination))
            ts("baseline.ts", [root, "SG21", "target-excluded", "development", replay_suffix], root / "blind-replay.log")
        finally:
            for source, destination in reversed(hidden):
                destination.rename(source)
        before = root / "baseline/SG21-target-excluded-development/predictions.json"
        after = root / "baseline" / f"SG21-target-excluded-development{replay_suffix}" / "predictions.json"
        assert sha(before) == sha(after), "baseline-replay-mismatch"
        output = root / "variants/SG21-target-excluded-test-combined/predictions.json"
        original = sha(output)
        ts("refine.ts", [root, "SG21", "target-excluded", "test", "combined"], root / "refinement-replay.log")
        assert sha(output) == original, "refinement-replay-mismatch"
        dump(root / "verification.json", {"inputsRehashed": len(prepared["files"]), "baselineWithoutTargetAnnotationsSha256": sha(after),
                                         "refinementReplayedSha256": original, "deterministic": True,
                                         "targetAnnotationsUnavailableDuringBaselineReplay": True})
        print("Input hashes, process replay, and target-annotation isolation verified.")


if __name__ == "__main__":
    main()
