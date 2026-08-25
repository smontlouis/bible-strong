# Lexicon Editorial Production

The Lexicon editor produces reviewed Bible, Strong, interlinear, topical, and lexical datasets for publication. Its outputs are immutable handoffs; it does not activate them in the Resource service.

## Language

**Lexical entry**:
A reviewed Hebrew or Greek dictionary entry identified by its canonical lexical identity.
_Avoid_: Strong page, definition row

**Editorial candidate**:
Proposed lexical content that has not yet passed the required review and quality gates.
_Avoid_: Draft release

**Reviewed lexical content**:
Editorial content that has passed the declared validation and review gates for its release workflow.
_Avoid_: Generated text

**Resource publication bundle**:
An immutable, validated handoff for exactly one Resource identity and Resource revision.
_Avoid_: Output directory, database dump

**Publication parity**:
Proof that canonical import data and its matching Offline-copy artifact represent the same complete Resource revision.
_Avoid_: Similar output, best-effort validation
