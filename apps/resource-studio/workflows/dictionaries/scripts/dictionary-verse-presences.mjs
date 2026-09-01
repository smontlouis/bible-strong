#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  biblicalNameFingerprint,
  extractCorrespondenceAliases,
  extractCorrespondenceVariants,
  normalizeCorrespondenceAlias
} from "./build-correspondences.mjs";

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
const defaultSeedsPath = path.join(
  workspaceRoot,
  "apps/resource-studio/config/resource-publications/dictionary-verse-presence-seeds.json"
);
const defaultBibles = {
  fr: path.join(
    workspaceRoot,
    "apps/resource-studio/outputs/resource-publications/ordinary-bibles/lsg/canonical/bible-lsg.json"
  ),
  en: path.join(
    workspaceRoot,
    "apps/resource-studio/outputs/resource-publications/ordinary-bibles/kjv/canonical/bible-kjv.json"
  )
};

const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const executeSql = (databasePath, sql) =>
  new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [databasePath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`sqlite3-exit-${code}:${stderr.trim()}`))
    );
    child.stdin.end(`${sql}\n`);
  });

const queryEntries = async (databasePath) => {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-json", databasePath, "SELECT id, word FROM dictionnaire ORDER BY id"],
    { maxBuffer: 128 * 1024 * 1024 }
  );
  return JSON.parse(stdout || "[]");
};

export const normalizePresenceText = (value) =>
  String(value)
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[’‘`]/gu, "'")
    .match(/[\p{Letter}\p{Number}]+(?:'[\p{Letter}\p{Number}]+)*/gu) ?? [];

const conceptKeyForEntry = (work, id, memberships) =>
  memberships.get(`${work}:${id}`) ?? `entry:${work}:${id}`;

const readBibleVerses = async (filePath) => {
  const value = JSON.parse(await readFile(filePath, "utf8"));
  const books = value.verses ?? value;
  const verses = [];
  for (const [book, chapters] of Object.entries(books)) {
    for (const [chapter, chapterVerses] of Object.entries(chapters)) {
      for (const [verse, payload] of Object.entries(chapterVerses)) {
        const text = typeof payload === "string" ? payload : payload?.text;
        if (typeof text === "string")
          verses.push({ verseKey: `${book}-${chapter}-${verse}`, text });
      }
    }
  }
  return verses;
};

const sequenceOccurs = (verseTokens, candidateTokens) => {
  if (candidateTokens.length > verseTokens.length) return false;
  outer: for (
    let index = 0;
    index <= verseTokens.length - candidateTokens.length;
    index += 1
  ) {
    for (let offset = 0; offset < candidateTokens.length; offset += 1) {
      if (verseTokens[index + offset] !== candidateTokens[offset])
        continue outer;
    }
    return true;
  }
  return false;
};

export const buildVersePresenceIndex = ({
  publications,
  entries,
  correspondenceIndex,
  namedSubjects,
  approvedSingleTokenSubjects = { fr: [], en: [] },
  bibles
}) => {
  const seededAliases = new Set(
    namedSubjects.flatMap((subject) =>
      extractCorrespondenceAliases(subject, "unfoldingword-translation-words")
    )
  );
  const seededFingerprints = new Set(
    [...seededAliases].map(biblicalNameFingerprint)
  );
  const memberships = new Map();
  const correspondenceStrategies = new Map();
  const membersByConcept = new Map();
  for (const group of correspondenceIndex.groups ?? []) {
    correspondenceStrategies.set(group.id, new Set(group.strategies ?? []));
    for (const member of group.members ?? []) {
      memberships.set(`${member.work}:${member.id}`, group.id);
      const members = membersByConcept.get(group.id) ?? [];
      members.push({
        work: member.work,
        id: Number(member.id),
        language: member.language
      });
      membersByConcept.set(group.id, members);
    }
  }
  for (const publication of publications) {
    for (const entry of entries.get(publication.work) ?? []) {
      const conceptKey = conceptKeyForEntry(
        publication.work,
        entry.id,
        memberships
      );
      if (!membersByConcept.has(conceptKey))
        membersByConcept.set(conceptKey, [
          {
            work: publication.work,
            id: Number(entry.id),
            language: publication.language
          }
        ]);
    }
  }

  const candidatesByLanguage = new Map([
    ["fr", new Map()],
    ["en", new Map()]
  ]);
  const trailingFunctionWords = {
    fr: new Set([
      "a",
      "au",
      "aux",
      "avec",
      "dans",
      "de",
      "des",
      "du",
      "en",
      "et",
      "ou",
      "par",
      "pour",
      "sur"
    ]),
    en: new Set([
      "and",
      "at",
      "by",
      "for",
      "from",
      "in",
      "of",
      "on",
      "or",
      "to",
      "with"
    ])
  };
  const approvedSingleTokensByLanguage = new Map(
    Object.entries(approvedSingleTokenSubjects).map(([language, subjects]) => [
      language,
      new Set(
        subjects.map((subject) => normalizePresenceText(subject).join(" "))
      )
    ])
  );
  for (const publication of publications) {
    const candidates = candidatesByLanguage.get(publication.language);
    for (const entry of entries.get(publication.work) ?? []) {
      const conceptKey = conceptKeyForEntry(
        publication.work,
        entry.id,
        memberships
      );
      const addCandidate = (variant, evidenceKind) => {
        const tokens = normalizePresenceText(variant);
        if (
          tokens.length === 0 ||
          (evidenceKind === "verse-phrase" &&
            (tokens.length < 2 ||
              trailingFunctionWords[publication.language].has(tokens.at(-1))))
        )
          return;
        const surface = tokens.join(" ");
        const matches = candidates.get(surface) ?? [];
        matches.push({
          conceptKey,
          work: publication.work,
          entryId: Number(entry.id),
          tokens,
          evidenceKind,
          surface
        });
        candidates.set(surface, matches);
      };
      let hasNameVariant = false;
      for (const variant of extractCorrespondenceVariants(
        entry.word,
        publication.work
      )) {
        const tokens = normalizePresenceText(variant);
        if (tokens.length === 0) continue;
        const normalizedAlias = normalizeCorrespondenceAlias(variant);
        const fingerprint = biblicalNameFingerprint(variant);
        const isAttestedTranslation =
          correspondenceStrategies
            .get(conceptKey)
            ?.has("named-subject-transliteration") &&
          fingerprint.length >= 3 &&
          seededFingerprints.has(fingerprint);
        const isName =
          seededAliases.has(normalizedAlias) ||
          isAttestedTranslation ||
          approvedSingleTokensByLanguage
            .get(publication.language)
            ?.has(tokens.join(" "));
        if (isName) {
          hasNameVariant = true;
          addCandidate(variant, "verse-name");
        }
      }
      if (!hasNameVariant) addCandidate(entry.word, "verse-phrase");
    }
  }

  const rejectedAliases = [];
  for (const [language, candidates] of candidatesByLanguage) {
    for (const [surface, matches] of candidates) {
      if (new Set(matches.map((match) => match.conceptKey)).size > 1) {
        candidates.delete(surface);
        rejectedAliases.push({
          language,
          surface,
          reason: "ambiguous-concept"
        });
      } else {
        candidates.set(surface, [
          ...new Map(
            matches.map((match) => [`${match.work}:${match.entryId}`, match])
          ).values()
        ]);
      }
    }
  }

  const anchorsByWork = new Map(
    publications.map((publication) => [publication.work, []])
  );
  const matches = [];
  for (const [language, bible] of Object.entries(bibles)) {
    const candidates = [...candidatesByLanguage.get(language).values()].flat();
    for (const verse of bible) {
      const verseTokens = normalizePresenceText(verse.text);
      for (const candidate of candidates) {
        if (!sequenceOccurs(verseTokens, candidate.tokens)) continue;
        matches.push({
          language,
          verseKey: verse.verseKey,
          conceptKey: candidate.conceptKey,
          evidenceKind: candidate.evidenceKind,
          surface: candidate.surface
        });
        anchorsByWork.get(candidate.work)?.push({
          verseKey: verse.verseKey,
          entryId: candidate.entryId,
          evidenceKind: candidate.evidenceKind
        });
      }
    }
  }
  for (const [work, anchors] of anchorsByWork) {
    const unique = new Map(
      anchors.map((anchor) => [
        `${anchor.verseKey}:${anchor.entryId}:${anchor.evidenceKind}`,
        anchor
      ])
    );
    anchorsByWork.set(
      work,
      [...unique.values()].sort(
        (left, right) =>
          left.verseKey.localeCompare(right.verseKey, "en", {
            numeric: true
          }) ||
          left.entryId - right.entryId ||
          left.evidenceKind.localeCompare(right.evidenceKind)
      )
    );
  }
  return { anchorsByWork, matches, rejectedAliases };
};

export const installDictionaryVersePresences = async ({
  configPath = defaultConfigPath,
  normalizedRoot = defaultNormalizedRoot,
  correspondenceIndex,
  biblePaths = defaultBibles,
  seedsPath = defaultSeedsPath,
  reportPath = path.join(normalizedRoot, "verse-presences.json")
} = {}) => {
  const resolvedConfigPath = path.resolve(configPath);
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  const configDirectory = path.dirname(resolvedConfigPath);
  const entries = new Map();
  for (const publication of config.publications) {
    entries.set(
      publication.work,
      await queryEntries(
        path.join(path.resolve(normalizedRoot), `${publication.work}.sqlite`)
      )
    );
  }
  const namedSubjects = (
    await Promise.all(
      config.publications
        .filter((publication) => publication.correspondenceSeedsPath)
        .map(async (publication) => {
          const seed = JSON.parse(
            await readFile(
              path.resolve(
                configDirectory,
                publication.correspondenceSeedsPath
              ),
              "utf8"
            )
          );
          return seed.namedSubjects ?? [];
        })
    )
  ).flat();
  const bibles = {
    fr: await readBibleVerses(path.resolve(biblePaths.fr)),
    en: await readBibleVerses(path.resolve(biblePaths.en))
  };
  const presenceSeeds = JSON.parse(
    await readFile(path.resolve(seedsPath), "utf8")
  );
  if (
    presenceSeeds.format !== "bible-strong-dictionary-verse-presence-seeds" ||
    presenceSeeds.schemaVersion !== 1
  )
    throw new Error("dictionary-verse-presence-seeds-invalid");
  const result = buildVersePresenceIndex({
    publications: config.publications,
    entries,
    correspondenceIndex,
    namedSubjects,
    approvedSingleTokenSubjects: presenceSeeds.approvedSingleTokenSubjects,
    bibles
  });
  for (const publication of config.publications) {
    const databasePath = path.join(
      path.resolve(normalizedRoot),
      `${publication.work}.sqlite`
    );
    const anchors = result.anchorsByWork.get(publication.work) ?? [];
    const sql = [
      "PRAGMA foreign_keys=ON;",
      "BEGIN IMMEDIATE;",
      "DELETE FROM dictionary_passage_anchors WHERE evidence_kind IN ('verse-name', 'verse-phrase');"
    ];
    anchors.forEach((anchor, ordinal) =>
      sql.push(
        `INSERT OR IGNORE INTO dictionary_passage_anchors (verse_key, entry_id, evidence_kind, ordinal) VALUES (${quoteSql(anchor.verseKey)}, ${anchor.entryId}, ${quoteSql(anchor.evidenceKind)}, ${ordinal});`
      )
    );
    sql.push("COMMIT;", "PRAGMA optimize;");
    await executeSql(databasePath, sql.join("\n"));
  }
  const report = {
    format: "bible-strong-dictionary-verse-presences",
    schemaVersion: 1,
    referenceBibles: { fr: "LSG", en: "KJV" },
    stats: {
      concepts: new Set(result.matches.map((match) => match.conceptKey)).size,
      verseConceptMatches: result.matches.length,
      installedAnchors: [...result.anchorsByWork.values()].reduce(
        (total, anchors) => total + anchors.length,
        0
      ),
      rejectedAmbiguousAliases: result.rejectedAliases.length
    },
    rejectedAliases: result.rejectedAliases
  };
  await writeFile(
    path.resolve(reportPath),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  return report;
};
