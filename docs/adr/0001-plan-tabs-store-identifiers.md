# Plan tabs store identifiers

Plan tabs store stable plan and slice identifiers rather than serialized plan or slice objects. Existing route screens may pass full computed objects through navigation params, but persisted tabs are long-lived workspace state; storing identifiers avoids stale duplicated content and lets the tab recover cleanly if the underlying reading plan changes.
