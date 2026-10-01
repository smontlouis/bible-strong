"""Local Eflomal experiment. Only unlabelled input files are read.

Held-out verses are processed independently with fixed corpus-derived priors.
Their local posterior inference cannot update another held-out verse's model.
"""
import argparse
from collections import defaultdict
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import subprocess
import tempfile
import time

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OMP_DYNAMIC"] = "FALSE"
import eflomal


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def parse_links(text, source_size, target_size):
    result = []
    for pair in text.split():
        left, right = map(int, pair.split("-"))
        if not (0 <= left < source_size and 0 <= right < target_size):
            raise ValueError("alignment-out-of-bounds")
        result.append([left, right])
    if len({tuple(p) for p in result}) != len(result):
        raise ValueError("duplicate-link")
    return sorted(result)


class PriorIndex:
    """Select exactly the priors upstream would retain for this pair's vocabulary."""
    def __init__(self, path):
        self.lex = defaultdict(list)
        self.source = defaultdict(list)
        self.target = defaultdict(list)
        self.global_lines = []
        for line in path.read_text().splitlines(keepends=True):
            fields = line.rstrip().split("\t")
            if fields[0] == "LEX":
                self.lex[fields[1].lower()].append((fields[2].lower(), line))
            elif fields[0] == "FERF":
                self.source[fields[1].lower()].append(line)
            elif fields[0] == "FERR":
                self.target[fields[1].lower()].append(line)
            elif fields[0] in ("HMMF", "HMMR"):
                self.global_lines.append(line)
            else:
                raise ValueError("unknown-prior-record")

    def for_pair(self, source, target):
        source = set(w.lower() for w in source)
        target = set(w.lower() for w in target)
        lines = list(self.global_lines)
        for word in sorted(source):
            lines.extend(line for trg, line in self.lex[word] if trg in target)
            lines.extend(self.source[word])
        for word in sorted(target):
            lines.extend(self.target[word])
        return io.StringIO("".join(lines))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--mode", choices=["train", "infer", "repeat"], required=True)
    parser.add_argument("--gold", choices=["Sg1910", "Darby", "DarbyR"])
    parser.add_argument("--representation", choices=["strong", "surface"])
    args = parser.parse_args()
    root = args.root.resolve()
    plan = json.loads((root / "plan.json").read_text())
    binary = Path(eflomal.__file__).parent / "bin/eflomal"
    identity = {
        "planSha256": digest((root / "plan.json").read_bytes()),
        "runnerSha256": digest(Path(__file__).read_bytes()),
        "binarySha256": digest(binary.read_bytes()),
        "python": platform.python_version(),
        "platform": platform.platform(),
        "ompThreads": 1,
        "seedPatch": "STRONG_EFLOMAL_SEED in private checkout",
    }
    for gold in [args.gold] if args.gold else ["Sg1910", "Darby", "DarbyR"]:
        directory = root / gold
        manifest = next(m for m in plan["manifests"] if m["gold"] == gold)
        for name, sha in manifest["inputs"].items():
            assert digest((directory / name).read_bytes()) == sha, f"input-drift:{name}"
        for representation in [args.representation] if args.representation else ["strong", "surface"]:
            model = directory / "eflomal" / representation
            model.mkdir(parents=True, exist_ok=True)
            model_identity = {**identity, "gold": gold, "representation": representation,
                              "trainingSeed": 17, "nSamplers": 3, "model": 3}
            meta_file = model / "training.json"
            if args.mode == "train":
                if meta_file.exists():
                    assert json.loads(meta_file.read_text())["identity"] == model_identity, "training-identity-drift"
                    print(f"{gold}/{representation}: verified existing training", flush=True)
                    continue
                os.environ["STRONG_EFLOMAL_SEED"] = "17"
                start = time.perf_counter()
                with tempfile.TemporaryDirectory(dir=model) as temp:
                    temp = Path(temp)
                    forward, reverse = temp / "train.fwd", temp / "train.rev"
                    with (directory / f"train.{representation}.txt").open() as src, (directory / "train.fr.txt").open() as trg:
                        eflomal.Aligner().align(src, trg, links_filename_fwd=str(forward), links_filename_rev=str(reverse))
                    source = (directory / f"train.{representation}.txt").read_text().splitlines()
                    target = (directory / "train.fr.txt").read_text().splitlines()
                    fwd, rev = forward.read_text().splitlines(), reverse.read_text().splitlines()
                    assert len(source) == len(target) == len(fwd) == len(rev) == manifest["trainingVerses"]
                    for s, t, f, r in zip(source, target, fwd, rev):
                        parse_links(f, len(s.split()), len(t.split()))
                        parse_links(r, len(s.split()), len(t.split()))
                    priors = eflomal.calculate_priors(source, target, fwd, rev, reverse=False)
                    with (temp / "priors.txt").open("w") as file:
                        eflomal.write_priors(file, *priors)
                    for name in ["train.fwd", "train.rev", "priors.txt"]:
                        (temp / name).replace(model / name)
                save(meta_file, {"identity": model_identity, "seconds": time.perf_counter() - start,
                                 "files": {name: digest((model / name).read_bytes()) for name in ["train.fwd", "train.rev", "priors.txt"]}})
                print(f"{gold}/{representation}: trained in {time.perf_counter() - start:.2f}s", flush=True)
                continue
            training = json.loads(meta_file.read_text())
            assert training["identity"] == model_identity, "training-identity-drift"
            for name, sha in training["files"].items():
                assert digest((model / name).read_bytes()) == sha, f"model-drift:{name}"
            rows = json.loads((directory / "eval-input.json").read_text())
            seeds = [17, 29, 43]
            if args.mode == "repeat":
                rows, seeds = rows[:25], [17]
            output = model / ("predictions.jsonl" if args.mode == "infer" else "repeat.jsonl")
            config = {"identity": model_identity, "priorsSha256": training["files"]["priors.txt"], "iterations": [4, 4, 16], "seeds": seeds, "refs": [r["ref"] for r in rows], "isolatedPerVerse": True}
            config_file = output.with_suffix(".config.json")
            if config_file.exists():
                assert json.loads(config_file.read_text()) == config, "inference-config-drift"
            else:
                assert not output.exists(), "missing-inference-config"
                save(config_file, config)
            completed = {}
            if output.exists():
                for line in output.read_text().splitlines():
                    r = json.loads(line)
                    key = (r["ref"], r["seed"])
                    assert key not in completed, "duplicate-result"
                    completed[key] = r
            prior_index = PriorIndex(model / "priors.txt")
            start = time.perf_counter()
            aligner = eflomal.Aligner(n_iterations=(4, 4, 16))
            with tempfile.TemporaryDirectory() as temp, output.open("a") as result_file:
                forward, reverse = Path(temp) / "fwd", Path(temp) / "rev"
                for seed in seeds:
                    os.environ["STRONG_EFLOMAL_SEED"] = str(seed)
                    for row in rows:
                        key = (row["ref"], seed)
                        if key in completed:
                            continue
                        source, target = row[representation], row["normalized"]
                        tick = time.perf_counter()
                        aligner.align(io.StringIO(" ".join(source) + "\n"), io.StringIO(" ".join(target) + "\n"),
                                      links_filename_fwd=str(forward), links_filename_rev=str(reverse),
                                      priors_input=prior_index.for_pair(source, target))
                        result = {"ref": row["ref"], "seed": seed,
                                  "forward": parse_links(forward.read_text(), len(source), len(target)),
                                  "reverse": parse_links(reverse.read_text(), len(source), len(target)),
                                  "elapsedMs": (time.perf_counter() - tick) * 1000}
                        result_file.write(json.dumps(result, ensure_ascii=False) + "\n")
                        result_file.flush()
                        completed[key] = result
                        if len(completed) % 120 == 0:
                            print(f"{gold}/{representation}: {len(completed)}/{len(rows) * len(seeds)}", flush=True)
            assert len(completed) == len(rows) * len(seeds)
            save(output.with_suffix(".meta.json"), {"lastInvocationSeconds": time.perf_counter() - start, "records": len(completed), "sha256": digest(output.read_bytes())})
            if args.mode == "repeat":
                base = {(r["ref"], r["seed"]): r for r in map(json.loads, (model / "predictions.jsonl").read_text().splitlines())}
                for key, result in completed.items():
                    assert result["forward"] == base[key]["forward"] and result["reverse"] == base[key]["reverse"], "repeat-drift"
            print(f"{gold}/{representation}: {args.mode} complete", flush=True)


if __name__ == "__main__":
    main()
