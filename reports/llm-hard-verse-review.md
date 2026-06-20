# LLM Hard-Verse Review

## Scope

This report summarizes a bounded LLM review on true profile-aware hard verses.

Commands run:

```sh
npm run generate:strong:hybrid -- --bible nbs --llm --llm-limit 3 --output-dir outputs/llm-hard-review
npm run generate:strong:hybrid -- --bible bds --llm --llm-limit 3 --output-dir outputs/llm-hard-review
npm run generate:strong:hybrid -- --bible fmar --llm --llm-limit 3 --output-dir outputs/llm-hard-review
npm run generate:strong:hybrid -- --bible s21 --llm --llm-limit 3 --output-dir outputs/llm-hard-review
```

No suggestions were applied to production TSVs. The LLM was used only as a suggestion generator.

## Summary

| Bible | Attempted verses | Accepted suggestions | Rejected suggestions | Prompt tokens | Completion tokens | Total tokens |
| ----- | ---------------: | -------------------: | -------------------: | ------------: | ----------------: | -----------: |
| NBS   |              `3` |                  `7` |                  `3` |      `10,791` |           `1,075` |     `11,866` |
| BDS   |              `3` |                  `8` |                  `0` |       `8,655` |             `834` |      `9,489` |
| FMAR  |              `3` |                  `4` |                  `7` |      `10,956` |           `1,810` |     `12,766` |
| S21   |              `3` |                  `9` |                  `3` |      `10,184` |           `1,311` |     `11,495` |
| Total |             `12` |                 `28` |                 `13` |      `40,586` |           `5,030` |     `45,616` |

Cost note: the local script captures token usage, but does not persist provider-specific dollar pricing. Treat `45,616` total tokens as the auditable cost proxy for this bounded run.

## Useful Suggestion Patterns

### NBS

- `Gen.2.8`: `Seigneur/H3068`, `façonné/H3335`
- `Gen.3.8`: `Seigneur/H3068`, `brise/H7307`, second `Seigneur/H3068`, `parmi/H8432`

These are plausible content or clearly translated relation tags. `H3068` on `Seigneur` is a recurring high-confidence pattern.

### BDS

- `Gen.2.2`: `créé/H6213`, `accomplies/H6213`
- `Gen.2.12`: `excellente/H2896`, `contrée/H0776`, `ambre/H0916`
- `Gen.3.18`: `chardons/H1863`, `produits/H6212`, `sol/H7704`

These are promising because BDS is dynamic and often needs semantic transfer rather than surface matching.

### FMAR

- `Gen.2.12`: `Bdellion/H0916`
- `Gen.4.7`: `Seigneurie/H4910`
- `Gen.7.15`: `couples/H8147`

Some FMAR suggestions are useful, but the high rejection count shows the LLM also proposes fragile preposition/function-word decisions.

### S21

- `Gen.2.2`: `mit un terme/H3615`, `terme/H4399`, `création/H6213`
- `Gen.2.4`: `Telle/H0428`, `histoire/H8435`
- `Gen.4.11`: `Désormais/H6258`, `entrouvert/H6475`, `boire/H3947`

Some are strong semantic matches, but several require editorial review because S21 paraphrases compactly.

## Rejected Or Not Promoted

No new LLM suggestions were promoted into deterministic overrides during this pass.

Reasons:

- Several accepted-by-validator suggestions are still editorially debatable, such as assigning a source preposition to a nearby content word.
- Some suggestions are correct semantically but need a generalized rule before production promotion.
- The sample is intentionally small: 12 hard verses total. It is enough to validate that LLM review is useful, not enough to establish production rules by itself.

## Recommendation

Keep the current policy:

1. Run deterministic `hybrid`.
2. Run bounded LLM review on real hard verses.
3. Review suggestions manually or by a stricter evaluator.
4. Promote only recurring, defensible patterns into `src/curatedStrongOverrides.ts` or deterministic phrase/rule logic.

Promising future promotion candidates:

- divine-name transfer such as `Seigneur/H3068` in NBS/BDS contexts;
- rare object nouns with exact semantic match, e.g. `Bdellion/H0916`, `ambre/H0916`;
- dynamic-expression mappings like `histoire/H8435` and `mit un terme/H3615`, after more samples.
