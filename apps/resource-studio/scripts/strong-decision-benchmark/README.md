# Strong decision benchmark

Offline experiment comparing the canonical deterministic engine, Laya MLX and
JEV through Vercel AI Gateway. It never applies decisions to production. Run the
commands below from `apps/resource-studio` using the monorepo Yarn installation.

## Setup

```sh
python3 -m venv outputs/tools/strong-decisions-venv
outputs/tools/strong-decisions-venv/bin/pip install -r scripts/strong-decision-benchmark/requirements.txt
outputs/tools/strong-decisions-venv/bin/python - <<'PY'
import json
from pathlib import Path
from huggingface_hub import snapshot_download
repo = 'aac6fef/laya-multilingual-mlx'
revision = 'f2b4faf51023039425946074e2cf1361d2db11d5'
model_path = snapshot_download(repo, revision=revision)
output = Path('outputs/strong-decision-benchmark/setup.json')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'repo': repo, 'revision': revision, 'path': model_path}, indent=2))
PY
```

JEV reads `AI_GATEWAY_API_KEY` from the environment or `../../.env`; use
`--env-file` for another existing local credential file. Secrets are never written
to requests, responses or logs. Python dependencies and weights stay outside Yarn.

## Prepare, run, inspect

Choose a fresh output directory. The preparer refuses to overwrite a dataset.
The explicit dictionary argument below is part of the experiment's provenance.
Omit it to evaluate the default production dictionary instead; a failed strict
dictionary check stops preparation.

```sh
for gold in Sg1910 Darby DarbyR; do
  NODE_OPTIONS=--max-old-space-size=8192 yarn exec tsx scripts/strong-decision-benchmark/prepare.ts \
    "$gold" 200 200 outputs/strong-decision-benchmark/pilot-v1 \
    data/dictionaries/strong_lexicon.en-fr.full.production.sqlite || break
done

for provider in laya jev; do
  outputs/tools/strong-decisions-venv/bin/python scripts/strong-decision-benchmark/run.py \
    --root outputs/strong-decision-benchmark/pilot-v1 --provider "$provider"
  for variant in reverse repeat; do
    outputs/tools/strong-decisions-venv/bin/python scripts/strong-decision-benchmark/run.py \
      --root outputs/strong-decision-benchmark/pilot-v1 --provider "$provider" \
      --variant "$variant" --limit 100
  done
done

yarn exec tsx scripts/strong-decision-benchmark/report.ts outputs/strong-decision-benchmark/pilot-v1
```

The two numbers after the gold ID are the verse sample size and maximum number
of residual decisions. Gold annotations are stripped before canonical generation;
the entire evaluated editorial family is excluded, and curated overrides are
disabled. The same reference sample is used for all editions. Candidates come
from the existing residual lexical report, not the expected annotations. Every
candidate must carry STEP evidence. At most five lexical candidates plus the
current visible target are presented, followed by NONE and UNSURE, in a stable
hash-based order.

Each provider receives only `state` and `questions` from `requests.jsonl`.
`dataset.json` contains the separate evaluation labels. Chapter-based splits
keep the same chapter in calibration or test across editions. The runner checks
Laya's actual token budgets for both providers and excludes any request that
would truncate its instructions, choices or state. JEV's declared rounding is
respected without renormalizing probabilities. Inconsistent choices are rejected.

Results are append-only and resumable, bound to request, runner and model hashes.
Existing errors are retained, not silently retried away on resume. The `repeat`
variant actually calls the provider again. The report verifies request hashes.
For a new prompt, model or runner, prepare a new output directory. The JEV alias
does not pin an immutable model revision; raw gateway routing and cost metadata
are preserved. Laya uses pinned FP16 weights, single-question batches and the GPU.

The report distinguishes choice accuracy from end-to-end carrier F1. Per-choice
labels require one original occurrence and one reference occurrence of the Strong.
An absent reference Strong is not treated as an empty placement. If the reference
has a visible target outside the candidates, UNSURE is the expected choice.
Repeated occurrences remain in the occurrence-aware pipeline evaluation. The
simulation blocks new overlaps, preserves the baseline on abstention and demotes
visible carriers on NONE without inventing empty anchors. It is an experimental
projection, not the production two-model consensus and lexical-filter workflow.

The predefined calibration goal is at least 30 accepted decisions and 98%
observed accuracy; absence of a qualifying threshold is reported. Fixed-threshold
tables are descriptive, not permission to choose a threshold using the test set.
Provider confidence fields are not compared: gating uses the selected option's
probability. Timing includes preparation and inference/network time; the first
local warm-up and model loading are excluded. Base-run timing was collected while
repository checks were also running and is not an isolated performance benchmark.

## Read-only system audit

```sh
yarn exec tsx scripts/strong-decision-benchmark/audit.ts outputs/strong-decision-benchmark/pilot-v1
```

This writes `system-audit.json` with candidate coverage, reference overlaps,
existing errors covered by the selected review cases, and a gold-informed oracle
simulation using the same application rules. It makes no model calls. The oracle
is a post-hoc diagnostic restricted to uniquely labeled cases and existing choices,
not a deployable policy or a theoretical ceiling. See the
[system review](../../docs/strong-alignment-system-review-2026-10-01.md).

## Validation

```sh
yarn exec tsx --test scripts/strong-decision-benchmark/benchmark.test.ts
outputs/tools/strong-decisions-venv/bin/python -m unittest discover \
  -s scripts/strong-decision-benchmark -p 'test_*.py'
yarn exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext \
  --esModuleInterop --skipLibCheck --strict scripts/strong-decision-benchmark/*.ts
```

See [the 2026-10-01 findings](../../docs/strong-decision-benchmark-2026-10-01.md).
