# Goal: Generate a Strong-Tagged Bible du Semeur

## Repository

Work in:

```sh
/Users/stephane/Projects/bible-strong/bible-lexicon-maker
```

## Context

The repository contains local Bible and Strong source data:

- `data/bibles/`: Bible JSON files, including `data/bibles/bible-bds.json` for Bible du Semeur.
- `data/strongs/`: existing Strong-tagged CSV files, including `Sg1910.csv`, `Darby.csv`, and `DarbyR.csv`.
- `data/discovery.md`: research notes and possible approaches for automatic Strong tagging.

The data folders are ignored by Git and should remain local.

An `AI_GATEWAY_KEY` may be available for LLM calls through Vercel AI Gateway. Use it only if it materially improves the result. Treat the available budget as capped at 40 USD, and stop before spending heavily unless there is clear evidence the method works.

## Main Objective

Build a working, repeatable local pipeline that generates a Strong-tagged version of Bible du Semeur from `data/bibles/bible-bds.json`.

The output must be usable locally and the pipeline should be reusable for other French Bible JSON files later.

## Implementation Freedom

Choose the most pragmatic method that gets a real result. Possible approaches include:

- Aligning BDS against existing Strong-tagged French references such as Sg1910, Darby, or DarbyR.
- Using original-language tagged sources mentioned in `data/discovery.md`, such as Macula Greek/Hebrew or Clear.Bible datasets.
- Using algorithmic alignment, statistical alignment, embedding alignment, LLM assistance, or a hybrid.
- Starting with a high-quality prototype and expanding to the full corpus when feasible.

Prefer a robust working pipeline over a perfect but unfinished research implementation.

## Important Constraints

- Do not commit `data/bibles/`, `data/strongs/`, or generated full Bible text outputs.
- Bible du Semeur is likely copyrighted. Generated Strong-tagged BDS is a local artifact only and should not be committed or redistributed.
- Commit code, scripts, configs, tests, and reports only if they do not include substantial copyrighted Bible text.
- Keep the pipeline runnable through an npm script.
- Report errors and low-confidence verses instead of failing the entire run.

## Expected Work Plan

1. Inspect the exact formats of the Bible JSON files and Strong CSV files.
2. Define a clear generated output format. Prefer compatibility with the existing Strong CSV shape:

   ```txt
   book_id,num_chapter,num_verse,text
   ```

   where `text` contains tags such as:

   ```html
   <w strong="H7225">commencement</w>
   ```

   A structured JSON output is also acceptable if it is more reliable, as long as it is documented.

3. Build an initial BDS generation pipeline.
4. Use existing tagged references, especially Sg1910 and Darby, as validation fixtures or gold references where useful.
5. Generate a local BDS Strong output.
6. Add metrics:

   - verse count processed,
   - verse coverage,
   - tagged-token coverage,
   - failed verse count,
   - low-confidence verse count,
   - examples of high, medium, and low confidence output without including long copyrighted excerpts.

7. Add automated tests for parsing, tokenization, alignment or propagation logic, and output formatting.
8. Add a documented npm command, for example:

   ```sh
   npm run generate:strong -- --bible bds
   ```

9. Write a local report, for example `reports/bds-strong-report.md`, explaining:

   - method chosen,
   - why it was chosen,
   - what was generated,
   - measured quality,
   - known limits,
   - next improvements.

10. Run verification:

    ```sh
    npm run typecheck
    npm run lint
    npm run build
    ```

    Run any tests added by the implementation.

11. If the result is satisfactory, create a Conventional Commits commit.

## Acceptance Criteria

- A documented command generates a local Strong-tagged output for `data/bibles/bible-bds.json`.
- The output preserves book/chapter/verse references.
- Strong codes are attached to BDS words or segments with confidence metadata when possible.
- The pipeline runs across the available BDS input without crashing.
- Failures and uncertain verses are collected in a report or diagnostics output.
- Verification scripts pass.
- The repository contains a concise report describing the actual result and limitations.

## Stop Conditions

Stop the goal cleanly if:

- The method is proven on a meaningful sample, but full execution is blocked by LLM budget, compute time, or an external download.
- Required source data is unavailable or legally unsuitable.
- Quality is clearly too poor for practical use and a different method is needed.

When stopping early, provide:

- evidence from the sample,
- estimated cost or compute needed to finish,
- exact commands to resume,
- next recommended approach.

