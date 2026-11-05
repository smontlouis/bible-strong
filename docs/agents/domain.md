# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Names in this repo

This repo has several contexts. Each context's glossary is a file named `CONTEXT.md`, and the root `CONTEXT-MAP.md` lists them.

- Wherever a skill says `GLOSSARY.md`, read and write the `CONTEXT.md` of the context in scope.
- Wherever a skill says `GLOSSARY-MAP.md`, use `CONTEXT-MAP.md`.
- Never create a `GLOSSARY.md` or a `GLOSSARY-MAP.md`. A new context gets its own `CONTEXT.md` and an entry in `CONTEXT-MAP.md`.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/index.md`** for the documentation map.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. Also check `<app-or-package>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```text
/
├── CONTEXT-MAP.md
├── docs/adr/                          <- system-wide decisions
├── apps/
│   ├── expo/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                  <- optional context-specific decisions
│   └── site/
│       └── CONTEXT.md
└── packages/
    ├── resource-service/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  <- optional context-specific decisions
    └── bible-reference-parser/
        └── CONTEXT.md
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`, and add the term to that `CONTEXT.md` once it is settled).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
