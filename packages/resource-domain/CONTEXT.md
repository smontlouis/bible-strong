# Shared Resource Language

**Wire contract**:
A platform-neutral schema defining data exchanged between a Resource producer and consumer.
_Avoid_: Mobile type, API type

**Resource identity**:
A durable identifier for one independently publishable editorial resource.
_Avoid_: File name, database name

**Resource cursor**:
An opaque continuation value belonging to one paginated Resource query.
_Avoid_: Page number

**Resource invariant**:
A rule that has the same meaning for every producer and consumer of a Resource.
_Avoid_: Client validation, server validation

**Resource DTO**:
The validated wire representation of one Resource value.
_Avoid_: Database row, view model
