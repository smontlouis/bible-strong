# ADR-0094: Link study resources through two pivots

## Status

Accepted

## Context

Nave topics, dictionary articles, Biblical entities and timeline events treat the same subjects but
only meet through verses, and sharing a verse does not mean sharing a subject. Linking every
resource to every other would solve homonymy several times over. Biblical entities cover people,
places and groups only, so they cannot carry themes; dictionary correspondence clusters are nearly
all in one language (125 of 8,069 are bilingual) and cannot carry them either.

## Decision

A generated `study-links` resource holds a graph of nodes and links. People, places and groups are
reached through their Biblical entity, and themes through their Nave topic, whose key is shared by
French and English. Every other relation is read through these two pivots.

Generation is fail-closed. A name opens a candidate, and only evidence confirms it: entity spellings
read from Strong spans, shared verses, the Strong number of the words in those verses, and for a
dictionary article the verses it cites. A correction names the link it touches and says why, and a
stale correction stops the build.

A node carries its labels in French and English, so a reader prints a link without opening the
resource behind it. A person only named by an event's description is shown on the event, not in the
person's list of events. The rule is shared by every reader through
`@bible-strong/resource-domain`.

The resource is definition-free and has no Download row. Like the Dictionary directory
([ADR-0037](./0037-separate-dictionary-directory-from-works.md)), its catalog id is bare, which
released apps skip.

## Consequences

The offline copy comes with a dictionary download, and a reader who misses it loses a section, not
a page. A reader with dictionaries already installed reads the links online until one is updated.

The resource is rebuilt when an entity, Nave, dictionary or timeline revision changes what it names.
An audit of the links must read every link of the most cited entities: their errors do not show in
a random sample of links, and they are the links readers meet first.
