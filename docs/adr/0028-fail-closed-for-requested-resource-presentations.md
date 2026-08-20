# ADR-0028: Fail closed for requested resource presentations

## Status

Accepted

## Context

Some resource readers treated a failed request as permission to construct a different presentation.
Reverse interlinear reading could replace a failed localized BHG index with the other locale, then
reconstruct missing source tokens from hundreds of individual Strong lexicon reads, and finally
return plain Bible text. Strong and BHG lexicon views could similarly switch Bible indexes after an
availability request failed. Multi-resource queries could return an incomplete result without
disclosing which requested corpus failed.

These substitutions hide the original failure, make observability ambiguous, and can amplify one
temporary error into a burst of requests. They also make a successful result mean something other
than the presentation or corpus the user requested.

## Decision

Fail a requested resource presentation when its selected logical resource fails during loading.
Do not switch locale, Bible index, presentation kind, or lexical dataset after a request error. Do
not reconstruct missing reverse-interlinear tokens from the Strong lexicon. Treat missing required
alignments as an integrity failure.

Automatic selectors may choose an available resource before loading begins. Once selected, a load
failure is final for that operation. A manual selection is never replaced automatically. Physical
source selection between an installed Offline copy and Online access remains allowed when both
adapters implement the same Resource identity and revision contract.

Aggregations that promise multiple requested corpora fail if any requested corpus fails. They do
not return partial results as though they were complete. Operations intentionally scoped to the
currently available Offline source while disconnected remain valid Offline reads.

Resource HTTP errors retain safe diagnostics such as status, server problem code, request ID, and
Retry-After so logs can distinguish rate limiting, authentication, server failure, timeout, and
transport failure without exposing App Check tokens or request contents.

This decision supersedes the runtime substitution clauses in ADR-0005, ADR-0013, and ADR-0014.
Their Resource identity, publication, Offline/Online adapter, and explicit source-selector
decisions remain current.

## Consequences

Requested Strong and interlinear modes now show their normal actionable unavailable state instead
of silently reverting to plain Bible text. Reverse interlinear failures no longer trigger a
per-identity Strong lexicon request fan-out. Search and commentary aggregations cannot appear
complete when one requested corpus failed.

The application may expose more visible temporary errors, but each error now identifies the failed
logical resource and can be investigated directly. Optional enrichment must either be explicitly
modeled as optional or omitted; it cannot silently change the meaning of a requested presentation.
