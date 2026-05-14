# Conventions

## General

- Use TypeScript and keep strict-mode compatibility.
- Prefer existing feature organization under `src/features/`.
- Prefer path aliases (`~features`, `~common`, `~helpers`, etc.) over deep relative imports.
- Keep changes scoped. Avoid opportunistic refactors in shared files like `BibleViewer`, `user.ts`, and `tabs.ts`.
- Use ASCII in new docs/code unless the surrounding file already uses French or another non-ASCII vocabulary.

## React And React Compiler

React Compiler is enabled.

Do not add these by default:

- `useMemo`
- `useCallback`
- `memo()`

Write idiomatic React first. Add manual memoization only if there is a concrete local reason and it does not fight the compiler.

## State

Use Redux for:

- durable user-owned Bible data
- Firestore-synced data
- global persistent settings
- reading plan state

Use Jotai for:

- tab and tab-group workspace state
- local UI state shared across components
- global modal atoms
- persisted UI preferences not owned by Firestore

Use component state for truly local ephemeral state.

## Styling

- Prefer existing shared UI primitives in `~common/ui`, especially `Box`, `HStack`, and `VStack`.
- Use Emotion/native patterns already present in the feature.
- Follow the theme system in `src/themes/`; do not hard-code new palettes unless the feature already does.
- For Reanimated 4 state-driven transitions, prefer CSS transition properties when appropriate.
- For SharedValues, use `.get()` and `.set()` rather than `.value`.

## Bible Feature

- Treat `BibleViewer.tsx`, `BibleDOM/`, and `useAnnotationMode.ts` as high-blast-radius code.
- Preserve the difference between verse-level highlights and word-level annotations.
- When changing Bible DOM rendering, verify selection, highlighting, notes/tags/link indicators, scrolling, and theme behavior.
- When changing bottom sheets in Bible view, smoke on a simulator because gestures and dynamic sizing are easy to break.

## Data And Sync

- Do not change persisted key formats casually.
- Do not rewrite `user.bible` entity shapes without a migration plan.
- Changes to Firestore sync, imports, exports, backups, and migrations require explicit validation notes.
- Prefer structured parsing/APIs over string manipulation for data transformations.

## i18n

- User-facing strings should go through `react-i18next`.
- Translation files live in `i18n/locales/fr/translation.json` and `i18n/locales/en/translation.json`.
- Run `yarn i18n` when adding/extracting translatable strings.

## Tests And Validation

Use risk-based validation:

- Docs-only: `yarn format:check` if docs are in Prettier scope; otherwise review manually.
- TypeScript/shared logic: `yarn typecheck`.
- Redux/helper logic: `yarn test`.
- UI or Bible behavior: simulator smoke with `serve-sim`.
- Sensitive flows: include before/after notes and avoid production environments.

## Naming

Use domain terms from `CONTEXT.md`:

- Bible version
- verse key
- selected verses
- highlight
- word annotation
- note
- tag
- bookmark
- link
- study
- resource database
- tab group

Avoid introducing synonyms for these concepts in new code or issues.

