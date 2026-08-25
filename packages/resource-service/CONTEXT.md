# Resource Delivery

The Resource service owns the validated publication and delivery of Bible Strong editorial resources. It separates immutable editorial input from runtime storage and Online or Offline-copy delivery.

## Language

**Resource identity**:
A durable identifier for one independently publishable editorial resource.
_Avoid_: File name, database name

**Resource revision**:
An immutable, content-derived edition of one Resource identity.
_Avoid_: Latest version, mutable version

**Resource publication bundle**:
A validated handoff containing canonical import data, an Offline-copy artifact, provenance, rights, integrity metadata, and one Resource revision.
_Avoid_: Build folder, database dump

**Resource catalog**:
Publication metadata selecting the active Resource revision and declaring its Online and Offline-copy availability.
_Avoid_: Feature flags

**Offline copy**:
A complete resource deliberately installed for durable use without a network connection.
_Avoid_: Cache, downloaded cache

**Online access**:
Remote reading of a Resource revision through the Resource API.
_Avoid_: Cloud fallback
