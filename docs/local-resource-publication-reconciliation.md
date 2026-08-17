# Local resource publication reconciliation

`resources:publication:reconcile` is the handoff smoke for a local release. Pass one or more
publication roots (the command walks nested language/module directories):

```bash
RESOURCE_PUBLICATION_ROOTS="outputs/releases/ordinary:outputs/releases/strong:outputs/releases/interlinear:outputs/releases/lexicon:outputs/releases/editorial" \
  npm run resources:publication:reconcile
```

The command reads `config/mobile-resource-required-ids.json`, maps each publication manifest to its
mobile catalog identity, and reports missing, duplicate, or unexpected identities. It also checks
that the declared canonical and Offline-copy files exist next to the manifest. A non-complete set
returns a non-zero exit code, so it can be used before handing the roots to Bible Strong.

The check is intentionally local and lightweight. Content checksums and domain-specific parity are
still performed by each publication validator and by the Bible Strong importer.
