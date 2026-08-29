import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  ENGLISH_LEXEME_REFINEMENT_POLICY,
  refineEnglishBibleLexemes,
  verseTextKey,
  type EnglishLexemeRefinementResult
} from "./englishLexemeRefinement.js";

const execFileAsync = promisify(execFile);
const ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");

export const DEFAULT_ENGLISH_LEXEME_INPUT_RELEASE =
  "outputs/releases/bible-strong-reverse-interlinear-v10-lexeme-refined-candidate";
export const DEFAULT_ENGLISH_LEXEME_OUTPUT_RELEASE =
  "outputs/releases/bible-strong-reverse-interlinear-v18-wordnet-context-candidate";

interface ReleaseBible {
  applicationVersionId: string;
  datasetId: string;
  sourceVersion: string;
  language: "fr" | "en";
  canonical: { file: string };
  strong: {
    file: string;
    entry: string;
    strongRevision: string;
    baseContentBytes: number;
    contentBytes: number;
    contentSha256: string;
    archiveBytes: number;
    archiveSha256: string;
    addedContentBytes: number;
    contentIncreaseRatio: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ReleaseCatalog {
  generatedAt: string;
  bibles: ReleaseBible[];
  [key: string]: unknown;
}

export async function refineEnglishStrongLexemeRelease(
  options: {
    root?: string;
    inputDir?: string;
    outputDir?: string;
    entityDatabasePath?: string;
    stepRuntimePath?: string;
    generatedAt?: string;
  } = {}
): Promise<{
  outputDir: string;
  inputCatalogSha256: string;
  catalogSha256: string;
  decisionDigest: string;
  decisionCount: number;
  correctionCount: number;
}> {
  const root = path.resolve(options.root ?? process.cwd());
  const inputDir = path.resolve(
    root,
    options.inputDir ?? DEFAULT_ENGLISH_LEXEME_INPUT_RELEASE
  );
  const outputDir = path.resolve(
    root,
    options.outputDir ?? DEFAULT_ENGLISH_LEXEME_OUTPUT_RELEASE
  );
  if (!existsSync(inputDir)) {
    throw new Error(`english-lexeme-input-release-missing:${inputDir}`);
  }
  if (existsSync(outputDir)) {
    throw new Error(`english-lexeme-output-release-exists:${outputDir}`);
  }
  const workingDir = `${outputDir}.work-${process.pid}-${randomUUID()}`;
  const buildDir = path.join(workingDir, ".english-lexeme-build");
  const inputCatalogPath = path.join(inputDir, "catalog.json");
  const inputCatalogSha256 = await sha256File(inputCatalogPath);

  try {
    await cp(inputDir, workingDir, { recursive: true });
    await removeMacMetadata(workingDir);
    const catalog = JSON.parse(
      await readFile(path.join(workingDir, "catalog.json"), "utf8")
    ) as ReleaseCatalog;
    const englishBibles = catalog.bibles.filter(
      ({ language }) => language === "en"
    );
    if (englishBibles.length !== 9) {
      throw new Error(
        `english-lexeme-release-bible-count:${englishBibles.length}`
      );
    }
    await mkdir(buildDir, { recursive: true });
    const lexicalResourceDigest = await digestLexicalResources(root);
    const surfaceCorpusDigest = logicalDigest(
      englishBibles.map((bible) => ({
        applicationVersionId: bible.applicationVersionId,
        canonical: bible.canonical
      }))
    );
    const buildInputs: Array<{
      applicationVersionId: string;
      sqlitePath: string;
      verseTexts: ReadonlyMap<string, string>;
      bible: ReleaseBible;
      bibleBuildDir: string;
      archivePath: string;
    }> = [];
    for (const bible of englishBibles) {
      const bibleBuildDir = path.join(
        buildDir,
        bible.applicationVersionId.toLowerCase()
      );
      await mkdir(bibleBuildDir, { recursive: true });
      const archivePath = path.join(workingDir, bible.strong.file);
      await execFileAsync("unzip", ["-q", archivePath, "-d", bibleBuildDir]);
      const canonicalArchivePath = path.join(workingDir, bible.canonical.file);
      await execFileAsync("unzip", [
        "-q",
        canonicalArchivePath,
        "-d",
        bibleBuildDir
      ]);
      const sqlitePath = path.join(bibleBuildDir, bible.strong.entry);
      if (!existsSync(sqlitePath)) {
        throw new Error(
          `english-lexeme-release-entry-missing:${bible.applicationVersionId}:${bible.strong.entry}`
        );
      }
      const canonicalEntry =
        (bible.canonical as { entry?: string }).entry ??
        path.basename(bible.canonical.file, ".zip");
      const verseTexts = await readCanonicalVerseTexts(
        path.join(bibleBuildDir, canonicalEntry),
        bible.applicationVersionId
      );
      buildInputs.push({
        applicationVersionId: bible.applicationVersionId,
        sqlitePath,
        verseTexts,
        bible,
        bibleBuildDir,
        archivePath
      });
    }

    const result = refineEnglishBibleLexemes({
      bibles: buildInputs.map(
        ({ applicationVersionId, sqlitePath, verseTexts }) => ({
          applicationVersionId,
          sqlitePath,
          verseTexts
        })
      ),
      entityDatabasePath: path.resolve(
        root,
        options.entityDatabasePath ??
          "data/entities/bible_entities.production.sqlite"
      ),
      stepRuntimePath: path.resolve(
        root,
        options.stepRuntimePath ??
          "outputs/releases/bible-step-interlinear-runtime-v4/bible-step-interlinear-en.sqlite"
      ),
      lexicalResourceDigest,
      surfaceCorpusDigest
    });
    const lexemeDir = path.join(workingDir, "lexemes");
    const auditDir = path.join(workingDir, "audits");
    await mkdir(lexemeDir, { recursive: true });
    await mkdir(auditDir, { recursive: true });
    const indexFile = "lexemes/english-lexeme-decisions-v9.sqlite";
    const indexPath = path.join(workingDir, indexFile);
    writeDecisionIndex(indexPath, result);
    const indexSha256 = await sha256File(indexPath);
    const indexBytes = (await stat(indexPath)).size;

    for (const input of buildInputs) {
      const bibleResult = result.bibles.find(
        ({ applicationVersionId }) =>
          applicationVersionId === input.applicationVersionId
      );
      if (!bibleResult) {
        throw new Error(
          `english-lexeme-release-result-missing:${input.applicationVersionId}`
        );
      }
      assertCanaries(input.applicationVersionId, bibleResult.remainingCanaries);
      const auditFile = `audits/${input.applicationVersionId.toLowerCase()}-english-lexeme-refinement-v9.json`;
      const auditPath = path.join(workingDir, auditFile);
      const { sqlitePath: _sqlitePath, ...auditableBibleResult } = bibleResult;
      await writeFile(
        auditPath,
        `${JSON.stringify(
          {
            format: "english-strong-lexeme-refinement-audit",
            schemaVersion: 2,
            datasetId: input.bible.datasetId,
            sourceVersion: input.bible.sourceVersion,
            sourceRelease: path.relative(root, inputDir),
            sourceCatalogSha256: inputCatalogSha256,
            entityRegistryDigest: result.entityRegistryDigest,
            morphologyDigest: result.morphologyDigest,
            lexicalResourceDigest: result.lexicalResourceDigest,
            surfaceCorpusDigest: result.surfaceCorpusDigest,
            lexicalCandidateDigest: result.lexicalCandidateDigest,
            ...auditableBibleResult
          },
          null,
          2
        )}\n`
      );
      await rm(input.archivePath, { force: true });
      await createDeterministicZip({
        inputPath: input.sqlitePath,
        entryName: input.bible.strong.entry,
        archivePath: input.archivePath,
        stagingRoot: path.join(input.bibleBuildDir, "zip")
      });
      const [contentStats, archiveStats] = await Promise.all([
        stat(input.sqlitePath),
        stat(input.archivePath)
      ]);
      const previousLexemeRefinement = input.bible.strong.lexemeRefinement;
      const previousHistory = Array.isArray(
        input.bible.strong.lexemeRefinementHistory
      )
        ? input.bible.strong.lexemeRefinementHistory
        : [];
      input.bible.strong = {
        ...input.bible.strong,
        strongRevision: bibleResult.refinedRevision,
        contentSha256: await sha256File(input.sqlitePath),
        contentBytes: contentStats.size,
        archiveSha256: await sha256File(input.archivePath),
        archiveBytes: archiveStats.size,
        addedContentBytes:
          contentStats.size - input.bible.strong.baseContentBytes,
        contentIncreaseRatio: ratio(
          contentStats.size - input.bible.strong.baseContentBytes,
          input.bible.strong.baseContentBytes
        ),
        lexemeRefinementHistory: [
          ...previousHistory,
          ...(previousLexemeRefinement ? [previousLexemeRefinement] : [])
        ],
        lexemeRefinement: {
          policy: ENGLISH_LEXEME_REFINEMENT_POLICY,
          decisionDigest: result.decisionDigest,
          appliedDigest: bibleResult.appliedDigest,
          sourceRevision: bibleResult.sourceRevision,
          correctionCount: bibleResult.correctionCount,
          retainedProvisionalCount: bibleResult.retainedProvisionalCount,
          lowMarginCount: bibleResult.lowMarginCount,
          remainingCanaries: bibleResult.remainingCanaries,
          audit: {
            file: auditFile,
            sha256: await sha256File(auditPath),
            bytes: (await stat(auditPath)).size
          }
        }
      };
    }

    const previousRootRefinement = catalog.englishLexemeRefinement;
    const previousRootHistory = Array.isArray(
      catalog.englishLexemeRefinementHistory
    )
      ? catalog.englishLexemeRefinementHistory
      : [];
    catalog.generatedAt = options.generatedAt ?? "2026-07-30T00:00:00.000Z";
    catalog.englishLexemeRefinementHistory = [
      ...previousRootHistory,
      ...(previousRootRefinement ? [previousRootRefinement] : [])
    ];
    catalog.englishLexemeRefinement = {
      schemaVersion: 2,
      policy: ENGLISH_LEXEME_REFINEMENT_POLICY,
      sourceRelease: path.relative(root, inputDir),
      sourceCatalogSha256: inputCatalogSha256,
      entityRegistryDigest: result.entityRegistryDigest,
      morphologyDigest: result.morphologyDigest,
      lexicalResourceDigest: result.lexicalResourceDigest,
      surfaceCorpusDigest: result.surfaceCorpusDigest,
      lexicalCandidateDigest: result.lexicalCandidateDigest,
      decisionDigest: result.decisionDigest,
      decisionCount: result.decisionCount,
      correctionCount: result.bibles.reduce(
        (sum, bible) => sum + bible.correctionCount,
        0
      ),
      index: {
        file: indexFile,
        sha256: indexSha256,
        bytes: indexBytes
      }
    };
    await writeFile(
      path.join(workingDir, "catalog.json"),
      `${JSON.stringify(catalog, null, 2)}\n`
    );
    const previousReport = await readFile(
      path.join(workingDir, "REPORT.md"),
      "utf8"
    );
    await writeFile(
      path.join(workingDir, "REPORT.md"),
      `${previousReport.trimEnd()}\n\n${renderRefinementReport(result, inputCatalogSha256)}`
    );
    await rm(buildDir, { recursive: true, force: true });
    await writeChecksums(workingDir);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(workingDir, outputDir);
    return {
      outputDir,
      inputCatalogSha256,
      catalogSha256: await sha256File(path.join(outputDir, "catalog.json")),
      decisionDigest: result.decisionDigest,
      decisionCount: result.decisionCount,
      correctionCount: result.bibles.reduce(
        (sum, bible) => sum + bible.correctionCount,
        0
      )
    };
  } catch (error) {
    await rm(workingDir, { recursive: true, force: true });
    throw error;
  }
}

function writeDecisionIndex(
  outputPath: string,
  result: EnglishLexemeRefinementResult
): void {
  const database = new DatabaseSync(outputPath);
  database.exec(`
    PRAGMA journal_mode=DELETE;
    PRAGMA foreign_keys=ON;
    CREATE TABLE Metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE EnglishLexemeDecisions (
      normalizedSurface TEXT NOT NULL,
      identityKind INTEGER NOT NULL CHECK(identityKind BETWEEN 0 AND 2),
      identityCode TEXT NOT NULL,
      lemma TEXT NOT NULL,
      partOfSpeech TEXT NOT NULL,
      method TEXT NOT NULL,
      evidenceCount INTEGER NOT NULL CHECK(evidenceCount > 0),
      confidence REAL NOT NULL CHECK(confidence > 0 AND confidence <= 1),
      sourcePartOfSpeech TEXT,
      sourceFingerprint TEXT NOT NULL,
      PRIMARY KEY(identityKind, identityCode, lemma)
    ) WITHOUT ROWID;
    CREATE TABLE EnglishLexemeCorrections (
      applicationVersionId TEXT NOT NULL,
      bookOrder INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      surface TEXT NOT NULL,
      lemma TEXT NOT NULL,
      previousPartOfSpeech TEXT NOT NULL,
      partOfSpeech TEXT NOT NULL,
      method TEXT NOT NULL,
      candidatePartsOfSpeech TEXT NOT NULL,
      decisionMargin REAL NOT NULL,
      evidence TEXT NOT NULL,
      sourcePartOfSpeech TEXT,
      identityKind INTEGER NOT NULL CHECK(identityKind BETWEEN 0 AND 3),
      identityCode TEXT NOT NULL,
      evidenceCount INTEGER NOT NULL CHECK(evidenceCount > 0),
      confidence REAL NOT NULL CHECK(confidence > 0 AND confidence <= 1),
      PRIMARY KEY(applicationVersionId,bookOrder,chapter,verse,ordinal)
    ) WITHOUT ROWID;
    CREATE TABLE EnglishLexicalCandidates (
      normalizedSurface TEXT NOT NULL,
      lemma TEXT NOT NULL,
      partOfSpeech TEXT NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY(normalizedSurface,lemma,partOfSpeech)
    ) WITHOUT ROWID;
  `);
  const insertMetadata = database.prepare(
    `INSERT INTO Metadata(key,value) VALUES (?,?)`
  );
  for (const [key, value] of Object.entries({
    policy: result.policy,
    entityRegistryDigest: result.entityRegistryDigest,
    morphologyDigest: result.morphologyDigest,
    lexicalResourceDigest: result.lexicalResourceDigest,
    surfaceCorpusDigest: result.surfaceCorpusDigest,
    lexicalCandidateDigest: result.lexicalCandidateDigest,
    decisionDigest: result.decisionDigest,
    decisionCount: String(result.decisionCount),
    correctionCount: String(
      result.bibles.reduce((sum, bible) => sum + bible.correctionCount, 0)
    )
  }).sort(([left], [right]) => left.localeCompare(right))) {
    insertMetadata.run(key, value);
  }
  const insertDecision = database.prepare(
    `INSERT INTO EnglishLexemeDecisions(
       normalizedSurface,identityKind,identityCode,lemma,partOfSpeech,
       method,evidenceCount,confidence,sourcePartOfSpeech,sourceFingerprint
     ) VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  for (const decision of result.decisions) {
    insertDecision.run(
      decision.lemma,
      decision.identityKind,
      decision.identityCode,
      decision.lemma,
      decision.partOfSpeech,
      decision.method,
      decision.evidenceCount,
      decision.confidence,
      decision.sourcePartOfSpeech ?? null,
      result.decisionDigest
    );
  }
  const insertCandidate = database.prepare(
    `INSERT INTO EnglishLexicalCandidates(
       normalizedSurface,lemma,partOfSpeech,source
     ) VALUES (?,?,?,?)`
  );
  for (const candidate of result.lexicalCandidates) {
    insertCandidate.run(
      candidate.normalizedSurface,
      candidate.lemma,
      candidate.partOfSpeech,
      candidate.source
    );
  }
  const insertCorrection = database.prepare(
    `INSERT INTO EnglishLexemeCorrections(
       applicationVersionId,bookOrder,chapter,verse,ordinal,surface,lemma,
       previousPartOfSpeech,partOfSpeech,method,candidatePartsOfSpeech,
       decisionMargin,evidence,sourcePartOfSpeech,identityKind,identityCode,
       evidenceCount,confidence
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  for (const bible of result.bibles) {
    for (const correction of bible.corrections) {
      insertCorrection.run(
        bible.applicationVersionId,
        correction.bookOrder,
        correction.chapter,
        correction.verse,
        correction.ordinal,
        correction.surface,
        correction.lemma,
        correction.previousPartOfSpeech,
        correction.partOfSpeech,
        correction.method,
        JSON.stringify(correction.candidatePartsOfSpeech),
        correction.decisionMargin,
        JSON.stringify(correction.evidence),
        correction.sourcePartOfSpeech ?? null,
        correction.identityKind,
        correction.identityCode,
        correction.evidenceCount,
        correction.confidence
      );
    }
  }
  database.exec("ANALYZE; VACUUM;");
  const integrity = (
    database.prepare("PRAGMA integrity_check").get() as {
      integrity_check: string;
    }
  ).integrity_check;
  database.close();
  if (integrity !== "ok") {
    throw new Error(`english-lexeme-decision-index-integrity:${integrity}`);
  }
}

async function createDeterministicZip(options: {
  inputPath: string;
  entryName: string;
  archivePath: string;
  stagingRoot: string;
}): Promise<void> {
  await mkdir(options.stagingRoot, { recursive: true });
  const stagedPath = path.join(options.stagingRoot, options.entryName);
  await copyFile(options.inputPath, stagedPath);
  await utimes(stagedPath, ZIP_TIME, ZIP_TIME);
  await execFileAsync(
    "zip",
    ["-X", "-9", "-q", options.archivePath, options.entryName],
    { cwd: options.stagingRoot, env: { ...process.env, TZ: "UTC" } }
  );
}

function assertCanaries(
  applicationVersionId: string,
  canaries: {
    h0430gVerb: number;
    h0430gCommonNotNoun: number;
    h0430gDivineNotName: number;
    jehovahNotName: number;
    capitalizedEntityVerb: number;
    knownLowercaseName: number;
    indeterminate: number;
  }
): void {
  if (
    canaries.h0430gVerb !== 0 ||
    canaries.h0430gCommonNotNoun !== 0 ||
    canaries.h0430gDivineNotName !== 0 ||
    canaries.jehovahNotName !== 0 ||
    canaries.capitalizedEntityVerb !== 0 ||
    canaries.knownLowercaseName !== 0 ||
    canaries.indeterminate !== 0
  ) {
    throw new Error(
      `english-lexeme-release-canary:${applicationVersionId}:${JSON.stringify(canaries)}`
    );
  }
}

function renderRefinementReport(
  result: EnglishLexemeRefinementResult,
  inputCatalogSha256: string
): string {
  const rows = result.bibles
    .map(
      (bible) =>
        `| ${bible.applicationVersionId} | ${bible.correctionCount.toLocaleString("fr-FR")} | ` +
        `${bible.correctionsByMethod["surface-entity"] ?? 0} | ` +
        `${bible.correctionsByMethod["surface-divine-identity"] ?? 0} | ` +
        `${bible.correctionsByMethod["dictionary-single-pos"] ?? 0} | ` +
        `${bible.correctionsByMethod["dictionary-context"] ?? 0} | ` +
        `${bible.correctionsByMethod["cross-version-consensus"] ?? 0} | ` +
        `${bible.correctionsByMethod["curated-override"] ?? 0} | ` +
        `${bible.lowMarginCount.toLocaleString("fr-FR")} |`
    )
    .join("\n");
  return `## Raffinement additif des lemmes/POS anglais

- Politique : \`${result.policy}\`
- Catalogue source : \`${inputCatalogSha256}\`
- Digest du registre d'entités : \`${result.entityRegistryDigest}\`
- Digest morphologique STEP : \`${result.morphologyDigest}\`
- Digest des ressources lexicales : \`${result.lexicalResourceDigest}\`
- Digest du corpus canonique : \`${result.surfaceCorpusDigest}\`
- Digest des candidats lexicaux : \`${result.lexicalCandidateDigest}\`
- Digest logique des décisions : \`${result.decisionDigest}\`
- Décisions de consensus : ${result.decisionCount.toLocaleString("fr-FR")}
- Corrections appliquées : ${result.bibles
    .reduce((sum, bible) => sum + bible.correctionCount, 0)
    .toLocaleString("fr-FR")}

| Bible | Corrections | Entités | Identités divines | Dictionnaire | Contexte | Consensus | Overrides | Faible marge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}

La passe ne publie jamais de POS vide ou indéterminé. Lorsqu'aucune preuve
déterministe ne justifie un remplacement, le POS concret précédent reste publié,
mais le cas est compté comme décision à faible marge et demeure inspectable.
Les candidats WordNet, décisions partagées et corrections localisées sont
conservés dans \`lexemes/english-lexeme-decisions-v9.sqlite\`; chaque Bible
possède également un audit JSON dédié.
`;
}

async function writeChecksums(directory: string): Promise<void> {
  const files = (
    await readdir(directory, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(directory, path.join(entry.parentPath, entry.name))
        .replaceAll(path.sep, "/")
    )
    .filter((file) => file !== "SHA256SUMS")
    .sort();
  const lines = await Promise.all(
    files.map(
      async (file) => `${await sha256File(path.join(directory, file))}  ${file}`
    )
  );
  await writeFile(path.join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`);
}

async function removeMacMetadata(directory: string): Promise<void> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true
  });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name === ".DS_Store")
      .map((entry) =>
        rm(path.join(entry.parentPath, entry.name), { force: true })
      )
  );
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function digestLexicalResources(root: string): Promise<string> {
  const relativeFiles = [
    "node_modules/wink-lexicon/package.json",
    "node_modules/wink-lexicon/src/irregular-nouns.js",
    "node_modules/wink-lexicon/src/irregular-verbs.js",
    "node_modules/wink-lexicon/src/lexicon.js",
    "node_modules/wink-lexicon/src/punctuations.js",
    "node_modules/wink-lexicon/src/singular-nouns.js",
    "node_modules/wink-lexicon/src/tags.js",
    "node_modules/wink-lexicon/src/uncountable-nouns.js",
    "node_modules/wink-lexicon/src/uninflected-nouns.js",
    "node_modules/wink-lexicon/src/unknown-words.js",
    "node_modules/wink-lexicon/src/wink-lexicon.js",
    "node_modules/wink-lexicon/src/wn-words.js",
    "node_modules/wink-lexicon/src/wn-word-senses.js",
    "node_modules/wink-lexicon/src/wn-senses.js",
    "node_modules/wink-lexicon/src/wn-adjective-exceptions.js",
    "node_modules/wink-lexicon/src/wn-noun-exceptions.js",
    "node_modules/wink-lexicon/src/wn-verb-exceptions.js",
    "node_modules/wink-lemmatizer/package.json",
    "node_modules/wink-lemmatizer/src/wink-lemmatizer.js",
    "node_modules/wink-pos-tagger/package.json",
    "node_modules/wink-pos-tagger/src/rules-engine.js",
    "node_modules/wink-pos-tagger/src/rules/consts.js",
    "node_modules/wink-pos-tagger/src/rules/pos-rules-ge0.js",
    "node_modules/wink-pos-tagger/src/rules/pos-rules-le0.js",
    "node_modules/wink-pos-tagger/src/rules/value-rules-ge0.js",
    "node_modules/wink-pos-tagger/src/rules/value-rules-le0.js",
    "node_modules/wink-pos-tagger/src/unigram-tagger.js",
    "node_modules/wink-pos-tagger/src/wink-pos-tagger.js",
    "node_modules/wink-tokenizer/package.json",
    "node_modules/wink-tokenizer/src/eng-contractions.js",
    "node_modules/wink-tokenizer/src/wink-tokenizer.js",
    "node_modules/wink-helpers/package.json",
    "node_modules/wink-helpers/src/wink-helpers.js",
    "node_modules/wink-porter2-stemmer/package.json",
    "node_modules/wink-porter2-stemmer/src/wink-porter2-stemmer.js"
  ];
  const entries = [];
  for (const relativeFile of relativeFiles) {
    entries.push({
      file: relativeFile,
      sha256: await sha256File(path.join(root, relativeFile))
    });
  }
  return logicalDigest(entries);
}

function logicalDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readCanonicalVerseTexts(
  canonicalPath: string,
  expectedApplicationVersionId: string
): Promise<ReadonlyMap<string, string>> {
  const canonical = JSON.parse(await readFile(canonicalPath, "utf8")) as {
    applicationVersionId: string;
    verses: Record<string, Record<string, Record<string, { text: string }>>>;
  };
  if (canonical.applicationVersionId !== expectedApplicationVersionId) {
    throw new Error(
      `english-lexeme-canonical-version:${expectedApplicationVersionId}:${canonical.applicationVersionId}`
    );
  }
  const result = new Map<string, string>();
  for (const [bookOrder, chapters] of Object.entries(canonical.verses)) {
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (const [verse, entry] of Object.entries(verses)) {
        result.set(
          verseTextKey(Number(bookOrder), Number(chapter), Number(verse)),
          entry.text
        );
      }
    }
  }
  return result;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6));
}

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const result = await refineEnglishStrongLexemeRelease({
    inputDir: readArg(args, "--input-dir"),
    outputDir: readArg(args, "--output-dir"),
    entityDatabasePath: readArg(args, "--entity-db"),
    stepRuntimePath: readArg(args, "--step-runtime"),
    generatedAt: readArg(args, "--generated-at")
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) await main();
