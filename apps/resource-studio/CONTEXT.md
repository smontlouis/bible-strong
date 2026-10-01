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

**Source occurrence**:
One word or segment at a specific position in an original-language textual reading. Repeated words remain distinct occurrences, and alternative Strong identifiers do not by themselves create additional occurrences.
_Avoid_: Strong number, dictionary entry

**Strong tagging alternative**:
One possible assignment of lexical identifiers to a source occurrence. A tagging may contain several component identifiers; a different manuscript reading is distinct from an equivalent identifier for the same reading.
_Avoid_: Synonym, interchangeable Strong list

**Translation relation**:
An evidenced association between one or more source occurrences and the words that express them in a translation. An unresolved relation is distinct from a reviewed absence of an explicit translation.
_Avoid_: Strong placement, missing number

**Strong display carrier**:
The translated word or expression that carries a chosen Strong identifier for the reader. Its boundaries and identifier are editorial choices distinct from the full translation relation.
_Avoid_: Source occurrence, semantic equivalent

**Grammatical realization**:
A source occurrence's syntactic function expressed by the construction of the translated sentence. This relation can coexist with an empty lexical display carrier when no distinct translated word realizes the occurrence.
_Avoid_: Lost meaning, untranslated grammar, failed lexical match

**Established empty Strong**:
A source occurrence whose lack of an explicit translated equivalent has been established for the target verse. Its absence justification is separate from the justification of its display position.
_Avoid_: Unmatched word, missing annotation, failed search

**Empty Strong anchor**:
A position for an empty Strong relative to translated carriers or a verse boundary, supported by source order or reference witnesses. A plausible anchor does not establish that the occurrence lacks an explicit translation.
_Avoid_: Translation, absence proof

**Unresolved Strong occurrence**:
A source occurrence for which the available evidence does not establish a translated carrier or an explicit absence. Lack of a candidate, a missing reference tag, and disagreement between witnesses may all leave an occurrence unresolved.
_Avoid_: Established empty Strong, omitted source word

**Strong resolution dossier**:
The target verse, source occurrences, witness evidence, proposed relations and review decisions needed to account for every Strong-bearing source occurrence in that verse.
_Avoid_: Confidence score, completed Bible

**Assisted translation review**:
A model-authored judgment about a particular source occurrence and translation, with its evidence and uncertainty retained. It is distinct from human review and independent adjudication.
_Avoid_: Gold label, independently validated relation

**Reviewed display choice**:
An explicit editorial decision selecting a visible carrier or empty anchor for an established translation relation. Establishing the relation does not by itself settle this choice.
_Avoid_: Translation proof, automatic absence

**Resource publication bundle**:
An immutable, validated handoff for exactly one Resource identity and Resource revision.
_Avoid_: Output directory, database dump

**Publication parity**:
Proof that canonical import data and its matching Offline-copy artifact represent the same complete Resource revision.
_Avoid_: Similar output, best-effort validation

**Words-of-Jesus decision**:
A reviewed choice of which characters of one Bible verse Jesus speaks, anchored to the exact verse text it was made for. An empty decision records a reviewed verse without words of Jesus.
_Avoid_: Red-words file, word-index range

**Self-contained canonical Bible**:
A canonical Bible publication whose verses carry their own headings and words of Jesus, delivered online and offline without side files.
_Avoid_: Bible with pericope and red-word bundle

**Dictionary entry correspondence**:
An evidenced relationship between independently authored dictionary entries that address the same headword or named subject.
_Avoid_: Merged definition, duplicate article

**Dictionary correspondence cluster**:
A set of dictionary entry correspondences that lets a reader move among sources without combining their content or attribution.
_Avoid_: Universal entry, merged word

**Dictionary entry link**:
An evidenced navigation link from text in one dictionary article to one exact entry in the same dictionary.
_Avoid_: Keyword link, inferred definition

**Dictionary passage anchor**:
An evidenced relationship from one canonical Bible verse to one exact dictionary entry, independent of the Bible version currently displayed.
_Avoid_: Verse word, highlighted dictionary word

**Dictionary verse presence**:
An evidenced relationship between one verse in a designated reference Bible and one dictionary correspondence cluster whose subject is represented in that verse. Evidence must come from a shared lexical identity or an explicitly approved exact alias.
_Avoid_: Dictionary passage anchor, fuzzy heading match, substring match

**Dictionary directory**:
A definition-free projection of dictionary works, entries, correspondence clusters, passage anchors, and verse presences used for global discovery.
_Avoid_: Merged dictionary, universal dictionary

**Direct EGW paragraph association**:
An ECSI relationship to one cited paragraph in an Ellen G. White work.
_Avoid_: Chapter association, neighboring paragraph inference

**Explicit EGW chapter association**:
A relationship declared by the source itself between one complete chapter of an Ellen G. White work and a Bible passage or passage range.
_Avoid_: Repeated paragraph-to-verse associations

**Indexed EGW section association**:
An ECSI relationship whose target is the structural heading of a section; the section is the documentary unit and its Bible scope comes from the ECSI entries that cite that heading.
_Avoid_: Direct paragraph association, inferred neighboring paragraph
