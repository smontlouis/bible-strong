# Study relations as a dedicated user graph

Study relations are stored as private user-owned graph edges in a dedicated `studyRelations` collection rather than as web links, note contents, tags, or embedded fields on each endpoint. This keeps external **Links**, thematic **Tags**, authored **Notes**, and explicit **Study relations** separate while allowing relations between verses, word annotations, notes, studies, and Strong entries to be discovered from both endpoints and later visualized as a graph.

A word annotation participates through its durable annotation identifier. Its Bible version, ranges, and selected-text snapshot remain annotation data rather than relation identity, so realignment does not change the endpoint key. Deleting an annotation leaves Manual relations available with their fallback label, consistently with other missing endpoints.
