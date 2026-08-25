# Application API

The Application API owns Firebase server operations used by Bible Strong clients when the operation cannot safely or reliably run on the client.

## Language

**Application function**:
A server operation invoked by a Bible Strong client for application-specific processing.
_Avoid_: Resource route, client helper

**Account-owned operation**:
An Application function whose result or side effect belongs to one authenticated account.
_Avoid_: Public resource operation
