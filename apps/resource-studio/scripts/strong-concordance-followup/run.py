"""Offline follow-up protocol: previous policy, independent ablations, fresh reserve."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile

SCRIPTS = Path("scripts/strong-concordance-followup")
PREVIOUS = "068ec210768f591c2a307106f912fd303568ae72"
CANONICAL = "dec602f8db67f94476f7f50a4289de5c405640a1"
CASES = [("SG21", "target-excluded"), ("SG21", "family-excluded"), ("NEG", "target-excluded"), ("NEG", "family-excluded"), ("Sg1910", "control-segond"), ("Darby", "control-darby"), ("DarbyR", "control-darby")]
VARIANTS = ["legacy", "readings", "expressions", "links", "readings-expressions", "all", "edition-adapted", "display-adapted"]

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def read(p):
    return json.loads(Path(p).read_text())

def write(p, value):
    Path(p).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

def ts(name, args, log):
    with Path(log).open("w") as f:
        subprocess.run(["yarn", "exec", "node", "--import", "tsx", str(SCRIPTS / name), *map(str, args)], stdout=f, stderr=subprocess.STDOUT, check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["init", "development", "freeze", "test", "verify"])
    parser.add_argument("--root", type=Path, default=Path("outputs/strong-concordance-reading-groups"))
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--selected-policy", default="all", choices=VARIANTS)
    args = parser.parse_args(); root = args.root.resolve();root.mkdir(parents=True, exist_ok=True)
    if args.stage == "init":
        if (root / "plan.json").exists(): raise ValueError("new-root-required")
        shutil.copyfile(SCRIPTS / "plan.json", root / "plan.json")
        for name, commit in [("initial-code", CANONICAL), ("previous-code", PREVIOUS)]:
            with (root / f"{name}.tar").open("wb") as f:
                subprocess.run(["git", "archive", commit, "apps/resource-studio"], cwd="../..", stdout=f, check=True)
            destination = root / name;destination.mkdir()
            with tarfile.open(root / f"{name}.tar") as tar:tar.extractall(destination, filter="data")
        if args.cache:shutil.copytree(args.cache, root / "acquisition")
        write(root / "initial-state.json", {"commit":PREVIOUS,"canonicalBaseCommit":CANONICAL,"planSha256":sha(root / "plan.json"),"codeArchiveSha256":sha(root / "initial-code.tar"),"previousCodeArchiveSha256":sha(root / "previous-code.tar")})
        print("Initialized; run the existing acquire.py, prepare.ts, then run.py baseline with this explicit root.")
    elif args.stage in ["development", "test"]:
        split = args.stage
        if split == "test":
            frozen = read(root / "followup-freeze.json")
            for f,h in frozen["code"].items():assert sha(f)==h,f
        for edition,scenario in CASES:
            for variant in VARIANTS:
                ts("predict.ts",[root,edition,scenario,split,variant],root/f"{split}-{edition}-{scenario}-{variant}-predict.log")
                ts("evaluate.ts",[root,edition,scenario,split,variant],root/f"{split}-{edition}-{scenario}-{variant}-evaluate.log")
            print(edition,scenario,split,"complete",flush=True)
    elif args.stage == "freeze":
        if (root / "followup-freeze.json").exists():raise ValueError("reserve-already-frozen")
        for edition,scenario in CASES:
            for variant in VARIANTS:
                receipt=read(root / "followup" / f"{edition}-{scenario}-development-{variant}" / "receipt.json")
                for f,h in receipt["code"].items():assert sha(f)==h,f
                assert (root / "evaluation-followup" / f"{edition}-{scenario}-development-{variant}" / "summary.json").exists()
        support=[Path(f"scripts/strong-concordance-night/{name}") for name in ["contract.ts","score.ts","acquire.py","prepare.ts","baseline.ts"]]
        files=sorted(set([*Path("src").rglob("*.ts"),*SCRIPTS.glob("*.ts"),SCRIPTS/"run.py",SCRIPTS/"plan.json",*support]))
        write(root / "followup-freeze.json", {"frozenAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"code":{str(f):sha(f) for f in files},"selectedPolicy":args.selected_policy,"variants":VARIANTS,"planSha256":sha(root / "plan.json"),"preparedInputsSha256":sha(root / "prepared-inputs.json"),"identityEligibility":"fixed-from-sealed-canonical-baseline","targetReserveLabelsConsulted":False})
        for f in files:
            destination=root/"followup-frozen-code"/f;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,destination)
        print("Frozen",args.selected_policy,"before reserved target inspection.")
    elif args.stage == "verify":
        for f,h in read(root/"prepared-inputs.json")["files"].items():assert sha(root/f)==h,f
        frozen=read(root/"followup-freeze.json")
        for f,h in frozen["code"].items():assert sha(f)==h,f
        initial=read(root/"initial-state.json")
        for name,key in [("initial-code","codeArchiveSha256"),("previous-code","previousCodeArchiveSha256")]:
            assert sha(root/f"{name}.tar")==initial[key]
            with tarfile.open(root/f"{name}.tar") as tar:
                for member in tar:
                    if member.isfile():assert hashlib.sha256(tar.extractfile(member).read()).hexdigest()==sha(root/name/member.name),member.name
        output=root/"followup/SG21-target-excluded-test-all/predictions.json";before=sha(output)
        hidden=[]
        try:
            for name in ["evaluator-only","acquisition","evaluation-followup"]:
                old=root/name;new=root/f"{name}.hidden-for-replay";old.rename(new);hidden.append((old,new))
            ts("predict.ts",[root,"SG21","target-excluded","test","all"],root/"blind-replay.log")
        finally:
            for old,new in reversed(hidden):new.rename(old)
        assert sha(output)==before,"prediction-drift-with-labels-unavailable"
        write(root/"followup-verification.json",{"allFrozenInputsVerified":True,"bothCodeArchivesVerified":True,"predictionsIdenticalWithoutTargetStores":True,"predictionsSha256":before,"networkModelCalls":0})
        print("Verified immutable inputs, both archives and identical predictions without target annotation stores.")

if __name__ == "__main__":main()
