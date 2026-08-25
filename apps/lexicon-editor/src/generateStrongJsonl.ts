import path from "node:path";

import {
  type GeneratedStrongJsonlView,
  loadDefaultStepIdentityIndex,
  writeGeneratedStrongJsonl
} from "./generatedStrongJsonl.js";

function optionalArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArg(name: string): string {
  const value = optionalArg(name);
  if (!value) throw new Error(`missing-argument:${name}`);
  return value;
}

async function main(): Promise<void> {
  const bible = requiredArg("--bible").toLowerCase();
  const requestedView = optionalArg("--view") ?? "reader";
  if (requestedView !== "reader" && requestedView !== "permissive") {
    throw new Error(`invalid-generated-jsonl-view:${requestedView}`);
  }
  const view = requestedView as GeneratedStrongJsonlView;
  const outputDir =
    optionalArg("--output-dir") ??
    path.join(
      "outputs",
      view === "reader" ? "strong-jsonl" : "strong-jsonl-permissive",
      bible
    );
  const outputPath =
    optionalArg("--output") ??
    path.join(outputDir, `bible-${bible}-strong.jsonl`);
  const manifestPath =
    optionalArg("--manifest") ?? path.join(outputDir, "manifest.json");
  const { identityFiles, identityIndex } = await loadDefaultStepIdentityIndex({
    stepLexiconDir: optionalArg("--step-lexicon-dir")
  });
  const result = await writeGeneratedStrongJsonl({
    bible,
    version: optionalArg("--version") ?? bible.toUpperCase(),
    sqlitePath:
      optionalArg("--sqlite") ??
      path.join("outputs", "strong", bible, `bible-${bible}-strong.sqlite`),
    outputPath,
    manifestPath,
    identityIndex,
    identityFiles,
    only: optionalArg("--only"),
    view,
    promotionPlanPath:
      view === "permissive"
        ? (optionalArg("--promotion-plan") ??
          path.join(
            "outputs",
            "strong",
            bible,
            `bible-${bible}-strong-permissive-plan.json`
          ))
        : undefined
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();
