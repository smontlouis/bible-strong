# Resource Authoring

Resource Studio acquires, transforms, validates, and packages Bible, commentary, Strong, interlinear, topical, dictionary, timeline, cross-reference, and lexical datasets. Its outputs are immutable handoffs; it does not import them into production, upload them, or activate them in the Resource service.

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

**Dictionary entry correspondence**:
An evidenced relationship between independently authored dictionary entries that address the same headword or named subject.
_Avoid_: Merged definition, duplicate article

**Dictionary correspondence cluster**:
A set of dictionary entry correspondences that lets a reader move among sources without combining their content or attribution.
_Avoid_: Universal entry, merged word

**Dictionary entry link**:
An evidenced navigation link from text in one dictionary article to one exact entry in the same dictionary.
_Avoid_: Keyword link, inferred definition
