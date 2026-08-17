# Local resource publication reconciliation

The canonical local publication store is `outputs/resource-publications`. Every producer writes
its final bundle under that directory; worktree-local `outputs/` directories are only temporary
build locations.

`resources:publication:reconcile` inventories the local release (the command walks nested
language/module directories):

```bash
npm run resources:publication:reconcile -- \
  --root outputs/resource-publications \
  --report outputs/resource-publications/reconciliation.json
```

The command reads `config/mobile-resource-required-ids.json`, maps each publication manifest to its
mobile catalog identity, and reports missing, duplicate, or unexpected identities. It also checks
that the declared canonical and Offline-copy files exist next to the manifest. A non-complete set
returns a non-zero exit code, so it can be used before handing the roots to Bible Strong.

The check is intentionally local and lightweight. Content checksums and domain-specific parity are
still performed by each publication validator and by the Bible Strong importer.
