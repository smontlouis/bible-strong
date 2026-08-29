import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  parseFrenchCodexAdjudicationArgs,
  runLexiconV3FrenchCodexPilotAdjudication
} from "./runLexiconV3FrenchCodexPilotAdjudication.js";

export { runLexiconV3FrenchCodexPilotAdjudication as runLexiconV3FrenchCodexAdjudication };

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchCodexPilotAdjudication(
    parseFrenchCodexAdjudicationArgs(process.argv.slice(2))
  )
    .then((result) => {
      process.stdout.write(
        `${JSON.stringify(
          {
            event: "french-codex-adjudication-complete",
            arbiter: result.arbiter?.counts,
            auditor: result.auditor?.counts,
            summaryPath: result.summaryPath
          },
          null,
          2
        )}\n`
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchCodexAdjudication")}: ${
          error instanceof Error ? error.stack : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
