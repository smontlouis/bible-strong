import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  parseFrenchCodexProposersArgs,
  runLexiconV3FrenchCodexPilotProposers
} from "./runLexiconV3FrenchCodexPilotProposers.js";

export { runLexiconV3FrenchCodexPilotProposers as runLexiconV3FrenchCodexProposers };

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchCodexPilotProposers(
    parseFrenchCodexProposersArgs(process.argv.slice(2))
  )
    .then((summary) => {
      process.stdout.write(
        `${JSON.stringify(
          {
            event: "french-codex-proposers-complete",
            runKind: summary.runKind,
            namespace: summary.namespace,
            coverage: summary.coverage,
            counts: summary.counts,
            usage: summary.usage,
            outputs: summary.outputs,
            summaryHash: summary.summaryHash
          },
          null,
          2
        )}\n`
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchCodexProposers")}: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
