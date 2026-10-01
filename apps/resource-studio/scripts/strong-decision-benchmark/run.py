"""Run identical, label-free Strong choice requests. No production writes."""
import argparse
import concurrent.futures
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import time
from pathlib import Path

import httpx
import laya_mlx as laya
from laya_mlx.common import build_prefix, render_options


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def read_key(env_file):
    key = os.environ.get("AI_GATEWAY_API_KEY")
    if key:
        return key
    for line in Path(env_file).read_text().splitlines():
        name, sep, value = line.partition("=")
        if sep and name.strip() in ("AI_GATEWAY_API_KEY", "AI_GATEWAY_KEY"):
            return value.strip().strip('"').strip("'")
    raise RuntimeError("AI Gateway key missing")


def validate(raw, request):
    answer = raw["answers"]["placement"]
    labels = request["questions"]["placement"]["criteria"]
    probs = answer["probabilities"]
    if answer["type"] != "choice" or set(probs) != set(labels) or answer["choice"] not in labels:
        raise ValueError("invalid-choice-contract")
    if any(not isinstance(p, (int, float)) or not math.isfinite(p) or not 0 <= p <= 1 for p in probs.values()):
        raise ValueError("invalid-probabilities")
    decimals = raw.get("rounding", {}).get("probabilityDecimals", 4)
    if not isinstance(decimals, int) or not 0 <= decimals <= 15:
        raise ValueError("invalid-rounding")
    rounding_error = 0.5 * 10 ** (-decimals)
    if abs(sum(probs.values()) - 1) > len(probs) * rounding_error + 0.000001:
        raise ValueError("invalid-probability-sum")
    selected = probs[answer["choice"]]
    if selected < max(probs.values()) - rounding_error:
        raise ValueError("choice-not-maximal")
    return {"choice": answer["choice"], "probability": selected, "probabilities": probs}


def truncation_reason(agent, request):
    q = agent._to_internal(request["questions"]["placement"])
    for option in render_options(q):
        if len(agent.tok(" " + option, add_special_tokens=False)["input_ids"]) > 48:
            return "option-over-48-tokens"
    prefix, _ = build_prefix(agent.tok, q, agent.cfg["head_max_len"])
    unbounded, _ = build_prefix(agent.tok, q, 100000)
    if prefix != unbounded:
        return "question-head-truncated"
    state_len = len(agent.tok(request["state"], add_special_tokens=False)["input_ids"])
    if len(prefix) + state_len + 1 > agent.cfg["max_len"]:
        return "state-truncated"
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--provider", choices=["laya", "jev"], required=True)
    parser.add_argument("--variant", choices=["base", "reverse", "repeat"], default="base")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--env-file", default="../../.env")
    parser.add_argument("--setup", default="outputs/strong-decision-benchmark/setup.json")
    args = parser.parse_args()
    root = Path(args.root)
    setup = json.loads(Path(args.setup).read_text())
    requests = []
    for p in sorted(root.glob("*/requests.jsonl")):
        requests.extend(json.loads(line) for line in p.read_text().splitlines() if line)
    requests.sort(key=lambda r: hashlib.sha256(r["id"].encode()).hexdigest())
    if args.limit:
        requests = requests[:args.limit]
    if not requests:
        raise RuntimeError("no-requests")
    if args.variant == "reverse":
        for r in requests:
            q = r["questions"]["placement"]
            q["criteria"] = dict(reversed(list(q["criteria"].items())))
    start = time.perf_counter()
    agent = laya.load(setup["path"], dtype="float16", device="gpu", batch_size=1)
    load_seconds = time.perf_counter() - start
    print(json.dumps({"loaded": args.provider, "loadSeconds": load_seconds, "requests": len(requests)}), flush=True)
    results_dir = root / "results"
    results_dir.mkdir(exist_ok=True)
    output = results_dir / f"{args.provider}-{args.variant}.jsonl"
    runner_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    identity = digest({"runner": runner_hash, "setup": setup, "provider": args.provider, "variant": args.variant})
    cached = {}
    if output.exists():
        for line in output.read_text().splitlines():
            row = json.loads(line)
            if row["identity"] != identity:
                raise RuntimeError("runner-or-model-changed-use-new-output-directory")
            cached[row["id"]] = row
    key = read_key(args.env_file) if args.provider == "jev" else None
    headers = {
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "ai-model-id": "typesafe-ai/jev", "ai-gateway-auth-method": "api-key",
        "ai-gateway-protocol-version": "0.0.1", "ai-evaluation-model-specification-version": "4",
    }
    client = httpx.Client(timeout=25)
    if args.provider == "laya":
        warm = next((r for r in requests if truncation_reason(agent, r) is None), None)
        if warm:
            agent.predict(warm["state"], warm["questions"])

    def execute(request):
        row = {"id": request["id"], "identity": identity, "requestSha256": digest(request), "provider": args.provider, "variant": args.variant}
        reason = truncation_reason(agent, request)
        if reason:
            return {**row, "status": "excluded", "reason": reason}
        started = time.perf_counter()
        attempts = 0
        raw = None
        try:
            if args.provider == "laya":
                attempts = 1
                raw = agent.predict(request["state"], request["questions"])
            else:
                for attempt in range(3):
                    attempts += 1
                    response = client.post("https://ai-gateway.vercel.sh/v4/ai/evaluation-model", headers=headers,
                        json={"state": request["state"], "questions": request["questions"]})
                    if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                        time.sleep(1 + attempt)
                        continue
                    if response.status_code != 200:
                        # Do not persist authentication headers or arbitrary provider error bodies.
                        raise RuntimeError(f"gateway-http-{response.status_code}")
                    raw = response.json()
                    break
            return {**row, "status": "ok", "attempts": attempts, "elapsedMs": (time.perf_counter() - started) * 1000,
                    **validate(raw, request), "raw": raw}
        except Exception as error:
            return {**row, "status": "error", "attempts": attempts, "elapsedMs": (time.perf_counter() - started) * 1000,
                    "reason": type(error).__name__ + ":" + str(error)[:200], "raw": raw}

    pending = []
    for request in requests:
        if request["id"] in cached:
            if cached[request["id"]]["requestSha256"] != digest(request):
                raise RuntimeError("request-changed")
        else:
            pending.append(request)
    started = time.perf_counter()
    counts = {}
    with output.open("a") as stream:
        workers = args.concurrency if args.provider == "jev" else 1
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            for index, row in enumerate(pool.map(execute, pending)):
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
                stream.flush()
                counts[row["status"]] = counts.get(row["status"], 0) + 1
                if (index + 1) % 25 == 0:
                    print(json.dumps({"completed": index + 1, "total": len(pending), "counts": counts}), flush=True)
    client.close()
    metadata = {"provider": args.provider, "model": setup if args.provider == "laya" else "typesafe-ai/jev (gateway alias; see raw response metadata)",
                "identity": identity, "runnerSha256": runner_hash, "variant": args.variant, "requested": len(requests), "cached": len(cached), "new": counts,
                "wallSeconds": time.perf_counter() - started, "loadSeconds": load_seconds, "concurrency": workers,
                "platform": platform.platform(), "python": platform.python_version(),
                "packages": {p: importlib.metadata.version(p) for p in ["laya-mlx", "mlx", "numpy", "tokenizers", "httpx"]}}
    output.with_suffix(".meta.json").write_text(json.dumps(metadata, indent=2))
    print(json.dumps(metadata), flush=True)


if __name__ == "__main__":
    main()
