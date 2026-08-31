#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const defaultConfigPath = path.join(
  workspaceRoot,
  "apps/resource-studio/config/resource-publications/dictionary.json"
);
const defaultNormalizedRoot = path.join(workflowRoot, ".local/normalized");

export const normalizeCorrespondenceAlias = (value) =>
  String(value)
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en")
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

export const extractCorrespondenceVariants = (word, work = "") => {
  const source = String(word)
    .trim()
    .replace(/[.;:,]+$/u, "");
  const candidates = new Set([source]);
  for (const candidate of source.split(/\s*;\s*|\s*,?\s+(?:or|ou)\s+/iu)) {
    if (candidate.trim()) candidates.add(candidate.trim());
  }
  if (work === "unfoldingword-translation-words") {
    for (const candidate of source.split(/\s*,\s*/u)) {
      if (candidate.trim()) candidates.add(candidate.trim());
    }
  }
  return [...candidates].filter(Boolean);
};

export const extractCorrespondenceAliases = (word, work = "") => [
  ...new Set(
    extractCorrespondenceVariants(word, work)
      .map(normalizeCorrespondenceAlias)
      .filter(Boolean)
  )
];

export const biblicalNameFingerprint = (value) =>
  normalizeCorrespondenceAlias(value)
    .replace(/\s+/gu, "")
    .replace(/ph/gu, "f")
    .replace(/(?:ch|kh|qu)/gu, "c")
    .replace(/th/gu, "t")
    .replace(/sh/gu, "s")
    .replace(/(?:tz|ts|zz|z)/gu, "s")
    .replace(/y/gu, "i")
    .replace(/(.)\1+/gu, "$1");

class UnionFind {
  constructor(size) {
    this.parents = Array.from({ length: size }, (_value, index) => index);
  }

  find(index) {
    if (this.parents[index] !== index)
      this.parents[index] = this.find(this.parents[index]);
    return this.parents[index];
  }

  union(left, right) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parents[rightRoot] = leftRoot;
  }
}

const preferredLabel = (members, namedSubjects) => {
  const memberFingerprints = new Set(
    members.flatMap((member) => member.aliases.map(biblicalNameFingerprint))
  );
  const seeded = namedSubjects.filter((subject) =>
    extractCorrespondenceAliases(subject).some((alias) =>
      memberFingerprints.has(biblicalNameFingerprint(alias))
    )
  );
  const candidates = seeded.length
    ? seeded
    : members.map((member) => member.word);
  return [...candidates].sort(
    (left, right) =>
      left.length - right.length || left.localeCompare(right, "en")
  )[0];
};

export const buildCorrespondenceIndex = ({ records, namedSubjects = [] }) => {
  const prepared = records.map((record) => ({
    ...record,
    aliases: extractCorrespondenceAliases(record.word, record.work)
  }));
  const unionFind = new UnionFind(prepared.length);
  const byLocalizedAlias = new Map();
  for (const [index, record] of prepared.entries()) {
    for (const alias of record.aliases) {
      const key = `${record.language}:${alias}`;
      const previous = byLocalizedAlias.get(key);
      if (previous !== undefined) unionFind.union(previous, index);
      else byLocalizedAlias.set(key, index);
    }
  }

  const seedFingerprints = new Set(
    namedSubjects.flatMap((subject) =>
      extractCorrespondenceAliases(subject).map(biblicalNameFingerprint)
    )
  );
  const normalizedSeedAliases = new Set(
    namedSubjects.flatMap((subject) => extractCorrespondenceAliases(subject))
  );
  const seedAnchorByFingerprint = new Map();
  for (const [index, record] of prepared.entries()) {
    for (const alias of record.aliases) {
      if (!normalizedSeedAliases.has(alias)) continue;
      const fingerprint = biblicalNameFingerprint(alias);
      if (fingerprint.length < 3 || !seedFingerprints.has(fingerprint))
        continue;
      const previous = seedAnchorByFingerprint.get(fingerprint);
      if (
        previous === undefined ||
        record.work === "unfoldingword-translation-words"
      )
        seedAnchorByFingerprint.set(fingerprint, index);
    }
  }
  for (const [index, record] of prepared.entries()) {
    if (record.language === "en") continue;
    for (const alias of record.aliases) {
      const anchor = seedAnchorByFingerprint.get(
        biblicalNameFingerprint(alias)
      );
      if (anchor !== undefined) unionFind.union(anchor, index);
    }
  }

  const clusters = new Map();
  for (const [index, record] of prepared.entries()) {
    const root = unionFind.find(index);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(record);
  }

  const groups = [];
  for (const members of clusters.values()) {
    if (new Set(members.map((member) => member.work)).size < 2) continue;
    const languages = new Set(members.map((member) => member.language));
    const hasExplicitAlias = members.some(
      (member) => member.aliases.length > 1
    );
    const aliases = [
      ...new Set(members.flatMap((member) => member.aliases))
    ].sort();
    const identity = members
      .map((member) => `${member.work}:${member.id}`)
      .sort()
      .join("|");
    groups.push({
      id: `dictionary-correspondence-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`,
      label: preferredLabel(members, namedSubjects),
      aliases,
      strategies: [
        "same-language-headword",
        ...(hasExplicitAlias ? ["explicit-headword-alias"] : []),
        ...(languages.size > 1 ? ["named-subject-transliteration"] : [])
      ],
      members: members
        .map(({ aliases: _aliases, ...member }) => member)
        .sort(
          (left, right) =>
            left.language.localeCompare(right.language) ||
            left.work.localeCompare(right.work) ||
            left.id - right.id
        )
    });
  }
  groups.sort((left, right) => left.label.localeCompare(right.label, "en"));
  return {
    format: "bible-strong-dictionary-correspondences",
    schemaVersion: 1,
    groups,
    stats: {
      entries: prepared.length,
      groups: groups.length,
      linkedEntries: groups.reduce(
        (total, group) => total + group.members.length,
        0
      ),
      bilingualGroups: groups.filter(
        (group) =>
          new Set(group.members.map((member) => member.language)).size > 1
      ).length
    }
  };
};

const queryEntries = async (databasePath) => {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-json", databasePath, "SELECT id, word FROM dictionnaire ORDER BY id"],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    }
  );
  return JSON.parse(stdout || "[]");
};

export const buildDictionaryCorrespondences = async ({
  configPath = defaultConfigPath,
  normalizedRoot = defaultNormalizedRoot,
  outputPath = path.join(normalizedRoot, "correspondences.json")
} = {}) => {
  const resolvedConfigPath = path.resolve(configPath);
  const configDirectory = path.dirname(resolvedConfigPath);
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  const records = (
    await Promise.all(
      config.publications.map(async (publication) => {
        const databasePath = path.join(
          path.resolve(normalizedRoot),
          `${publication.work}.sqlite`
        );
        const entries = await queryEntries(databasePath);
        return entries.map((entry) => ({
          work: publication.work,
          resourceId: publication.resourceId,
          language: publication.language,
          id: entry.id,
          word: entry.word
        }));
      })
    )
  ).flat();
  const namedSubjects = (
    await Promise.all(
      config.publications
        .filter((publication) => publication.correspondenceSeedsPath)
        .map(async (publication) => {
          const seedPath = path.resolve(
            configDirectory,
            publication.correspondenceSeedsPath
          );
          const seed = JSON.parse(await readFile(seedPath, "utf8"));
          return seed.namedSubjects ?? [];
        })
    )
  ).flat();
  const result = buildCorrespondenceIndex({ records, namedSubjects });
  await writeFile(
    path.resolve(outputPath),
    `${JSON.stringify(result, null, 2)}\n`
  );
  return result;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await buildDictionaryCorrespondences();
  process.stdout.write(`${JSON.stringify(result.stats, null, 2)}\n`);
}
