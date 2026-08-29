import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

interface PackageFile {
  scripts: Record<string, string>;
}

const packageFile = JSON.parse(
  readFileSync("package.json", "utf8")
) as PackageFile;

test("keeps every default v3 French path internal and offline", () => {
  const roots = ["lexicon:v3:prepare:fr", "lexicon:v3:translate:fr"];
  const visited = new Set<string>();
  const commands: string[] = [];
  const visit = (name: string): void => {
    if (visited.has(name)) return;
    visited.add(name);
    const command = packageFile.scripts[name];
    assert.ok(command, `missing package script ${name}`);
    commands.push(command);
    for (const match of command.matchAll(/npm run ([\w:-]+)/gu)) {
      const dependency = match[1];
      if (dependency) visit(dependency);
    }
  };
  roots.forEach(visit);
  const closure = commands.join("\n");
  assert.doesNotMatch(
    closure,
    /generateLexiconV3French\.ts|translate:fr:gateway|ai-gateway|deepl|gemini|--dry-run/iu
  );

  for (const file of [
    "scripts/buildLexiconV3FrenchInternalConfiguration.ts",
    "scripts/assembleLexiconV3FrenchInternalReview.ts"
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /fetch\s*\(|https?:\/\//iu, file);
  }
});

test("does not expose the unsafe staging full-chain shortcut", () => {
  assert.equal(
    packageFile.scripts["lexicon:v3:staging:refresh:full"],
    undefined
  );
});

test("retains the former Gateway generator only behind an explicit opt-in name", () => {
  assert.match(
    packageFile.scripts["lexicon:v3:translate:fr:gateway"] ?? "",
    /generateLexiconV3French\.ts/u
  );
  assert.doesNotMatch(
    packageFile.scripts["lexicon:v3:translate:fr"] ?? "",
    /generateLexiconV3French\.ts|gateway/iu
  );
});
