# Bible Reference Parsing

The Bible reference parser recognizes French and English textual Bible references and returns canonical passage coordinates for Bible Strong clients.

## Language

**Bible reference**:
Text naming a Bible book and a chapter, verse, or passage range.
_Avoid_: Link, citation string

**Canonical passage reference**:
The normalized book, chapter, verse, and range coordinates produced from a Bible reference.
_Avoid_: Parsed URL, verse key

**Book alias**:
A supported localized abbreviation or spelling that identifies one canonical Bible book.
_Avoid_: Translation name
