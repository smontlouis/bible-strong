"""JEV-only archived evaluation; no labels, production writes or generative fallback."""
import argparse
import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import time

import httpx


def digest_bytes(value):
    return hashlib.sha256(value).hexdigest()


def digest(value):
    return digest_bytes(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


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
    if any(isinstance(p, bool) or not isinstance(p, (int, float)) or not math.isfinite(p) or not 0 <= p <= 1 for p in probs.values()):
        raise ValueError("invalid-probabilities")
    decimals = raw.get("rounding", {}).get("probabilityDecimals", 4)
    if type(decimals) is not int or not 0 <= decimals <= 15:
        raise ValueError("invalid-rounding")
    epsilon = 0.5 * 10 ** (-decimals)
    if abs(sum(probs.values()) - 1) > len(probs) * epsilon + .000001:
        raise ValueError("invalid-probability-sum")
    if probs[answer["choice"]] < max(probs.values()) - epsilon:
        raise ValueError("choice-not-maximal")
    # Fail closed on provider warnings, including truncation; never silently score incomplete state.
    if raw.get("warnings"):
        raise ValueError("provider-warnings")
    return {"choice": answer["choice"], "probability": probs[answer["choice"]], "probabilities": probs}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--mode", choices=["base", "repeat", "reverse"], default="base")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--env-file", default="../../.env")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    if not 1 <= args.concurrency <= 8:
        raise ValueError("concurrency-out-of-range")
    root = Path(args.root)
    manifest = json.loads((root / "manifest.json").read_text())
    for name in ["requests.jsonl", "policy.json"]:
        if digest_bytes((root / name).read_bytes()) != manifest["files"][name]:
            raise RuntimeError("input-hash-mismatch")
    policy = json.loads((root / "policy.json").read_text())
    requests = [json.loads(line) for line in (root / "requests.jsonl").read_text().splitlines()]
    if args.mode != "base":
        requests = sorted((r for r in requests if r["variant"] == "context"), key=lambda r: digest_bytes(r["caseId"].encode()))[:policy["stabilityCases"]]
    if args.limit:
        requests = requests[:args.limit]
    if args.mode == "reverse":
        for r in requests:
            q = r["questions"]["placement"]
            q["criteria"] = dict(reversed(list(q["criteria"].items())))
    if len({r["id"] for r in requests}) != len(requests):
        raise RuntimeError("duplicate-request-id")
    output = root / f"jev-{args.mode}.jsonl"
    identity = digest({"runner": digest_bytes(Path(__file__).read_bytes()), "manifest": digest_bytes((root / "manifest.json").read_bytes()), "model": "typesafe-ai/jev", "mode": args.mode})
    cached = {}
    if output.exists():
        for line in output.read_text().splitlines():
            row = json.loads(line)
            if row["identity"] != identity or row["id"] in cached:
                raise RuntimeError("cache-identity-or-duplicate-mismatch")
            cached[row["id"]] = row
    pending = []
    for r in requests:
        if r["id"] in cached:
            if cached[r["id"]]["requestSha256"] != digest(r):
                raise RuntimeError("request-hash-mismatch")
        else:
            pending.append(r)
    key = read_key(args.env_file)
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "ai-model-id": "typesafe-ai/jev", "ai-gateway-auth-method": "api-key", "ai-gateway-protocol-version": "0.0.1", "ai-evaluation-model-specification-version": "4"}
    client = httpx.Client(timeout=25)

    def execute(r):
        row = {"id": r["id"], "identity": identity, "requestSha256": digest(r), "mode": args.mode}
        # Bounded requests; reject rather than truncate. 24KB is well below advertised 32K context.
        if len(json.dumps(r, ensure_ascii=False).encode()) > 24000:
            return {**row, "status": "excluded", "reason": "request-over-byte-budget"}
        raw = None
        started = time.perf_counter()
        attempts = 0
        try:
            for attempt in range(3):
                attempts += 1
                response = client.post("https://ai-gateway.vercel.sh/v4/ai/evaluation-model", headers=headers, json={"state": r["state"], "questions": r["questions"]})
                if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(1 + attempt)
                    continue
                if response.status_code != 200:
                    raise RuntimeError(f"gateway-http-{response.status_code}")
                raw = response.json()
                break
            return {**row, "status": "ok", "attempts": attempts, "elapsedMs": (time.perf_counter()-started)*1000, **validate(raw,r), "raw":raw}
        except Exception as error:
            # Do not serialize request headers, credentials or arbitrary HTTP error bodies.
            reason = str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__
            return {**row, "status": "error", "attempts":attempts, "elapsedMs":(time.perf_counter()-started)*1000, "reason":reason[:150], "raw":raw}

    start = time.perf_counter()
    counts = {}
    print(json.dumps({"mode":args.mode,"pending":len(pending),"cached":len(cached)}),flush=True)
    with output.open("a") as stream, concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        for index, row in enumerate(pool.map(execute,pending)):
            stream.write(json.dumps(row,ensure_ascii=False)+"\n")
            stream.flush()
            counts[row["status"]] = counts.get(row["status"],0)+1
            if (index+1)%100 == 0:
                print(json.dumps({"completed":index+1,"total":len(pending),"counts":counts}),flush=True)
    client.close()
    meta = {"identity":identity,"runnerSha256":digest_bytes(Path(__file__).read_bytes()),"outputSha256":digest_bytes(output.read_bytes()),"mode":args.mode,"requested":len(requests),"new":counts,"cached":len(cached),"wallSeconds":time.perf_counter()-start,"concurrency":args.concurrency,"python":platform.python_version(),"httpx":httpx.__version__,"model":"typesafe-ai/jev (mutable gateway alias)"}
    output.with_suffix(".meta.json").write_text(json.dumps(meta,indent=2)+"\n")
    print(json.dumps(meta),flush=True)


if __name__ == "__main__":
    main()
