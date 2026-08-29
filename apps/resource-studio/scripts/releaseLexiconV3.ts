import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createLexiconV3ReleaseCandidate,
  type LexiconV3ReleaseProfile,
  planLexiconV3Release,
  promoteLexiconV3Release,
  verifyLexiconV3Release
} from "../src/lexiconV3/release.js";
import { verifyLexiconV3Schema } from "../src/lexiconV3/schema.js";

const DEFAULT_DB = "outputs/lexicon-v3/authoring.sqlite";

function main(): void {
  const args = parseLexiconV3ReleaseArgs(process.argv.slice(2));
  const command = args.command ?? "plan";
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  if (!existsSync(dbPath)) throw new Error(`missing-authoring-db:${dbPath}`);
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const schema = verifyLexiconV3Schema(db);
    if (!schema.ok) {
      throw new Error(`invalid-authoring-schema:${JSON.stringify(schema)}`);
    }
    const profile = parseProfile(args.profile);
    if (command === "plan") {
      const plan = planLexiconV3Release(db, { profile });
      const errorCounts = Object.fromEntries(
        [...new Set(plan.errors.map((error) => error.split(":")[0] ?? error))]
          .sort()
          .map((code) => [
            code,
            plan.errors.filter((error) => error.startsWith(`${code}:`)).length
          ])
      );
      print({
        database: dbPath,
        profile: plan.profile,
        expectedEntryCount: plan.expectedEntryCount,
        fieldCount: plan.fields.length,
        carrierCount: plan.carriers.length,
        sourceFingerprint: plan.sourceFingerprint,
        snapshotFingerprint: plan.snapshotFingerprint,
        errorCount: plan.errors.length,
        errorCounts,
        ...(args.verbose === "true"
          ? { errors: plan.errors }
          : { errorSamples: plan.errors.slice(0, 50) })
      });
      if (plan.errors.length > 0) process.exitCode = 2;
      return;
    }

    const releaseKey = args.releaseKey?.trim();
    if (!releaseKey) throw new Error("missing-release-key");
    if (command === "candidate") {
      print(
        createLexiconV3ReleaseCandidate(db, {
          releaseKey,
          profile,
          policyVersion: args.policyVersion,
          codeFingerprint: args.codeFingerprint
        })
      );
      return;
    }
    if (command === "promote") {
      print(promoteLexiconV3Release(db, releaseKey, args.promotedAt));
      return;
    }
    if (command === "verify") {
      const result = verifyLexiconV3Release(
        db,
        releaseKey,
        args.current === "true"
      );
      print(result);
      if (!result.ok) process.exitCode = 2;
      return;
    }
    throw new Error(`unknown-command:${command}`);
  } finally {
    db.close();
  }
}

function parseProfile(value: string | undefined): LexiconV3ReleaseProfile {
  const profile = value?.trim() || "bilingual";
  if (profile !== "bilingual" && profile !== "core-en") {
    throw new Error(`invalid-release-profile:${profile}`);
  }
  return profile;
}

export function parseLexiconV3ReleaseArgs(
  argv: readonly string[]
): Record<string, string> {
  const allowed = new Set([
    "db",
    "profile",
    "releaseKey",
    "policyVersion",
    "codeFingerprint",
    "promotedAt",
    "current",
    "verbose"
  ]);
  const args: Record<string, string> = {};
  let commandSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--")) {
      if (commandSeen) throw new Error(`unexpected-argument:${token}`);
      if (!["plan", "candidate", "promote", "verify"].includes(token)) {
        throw new Error(`unknown-command:${token}`);
      }
      args.command = token;
      commandSeen = true;
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = camelCase(rawKey);
    if (!allowed.has(key)) throw new Error(`unknown-option:${rawKey}`);
    if (args[key] !== undefined) throw new Error(`duplicate-option:${rawKey}`);
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) throw new Error(`missing-value:${rawKey}`);
      args[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else throw new Error(`missing-value:${rawKey}`);
  }
  return args;
}

function camelCase(value: string): string {
  return value.replace(/-([a-z])/gu, (_, letter: string) =>
    letter.toUpperCase()
  );
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`releaseLexiconV3: ${message}\n`);
    process.exitCode = 1;
  }
}
