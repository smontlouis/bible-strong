import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  packageMobileStrongBibles,
  type MobileStrongBibleCatalog,
  type MobileStrongBibleSource
} from "./packageMobileStrongBibles.js";
import {
  augmentStrongBibleWithReverseInterlinear,
  loadReverseInterlinearStepIndex,
  REVERSE_INTERLINEAR_MOBILE_SCHEMA_VERSION,
  type ReverseInterlinearMetrics,
  type StrongSanitizationAudit
} from "./reverseInterlinearMobile.js";

const execFileAsync = promisify(execFile);
const ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");

export const DEFAULT_REVERSE_INTERLINEAR_RELEASE =
  "outputs/releases/bible-strong-reverse-interlinear-v9-sanitized-candidate";

export const REVERSE_INTERLINEAR_BIBLE_SOURCES = [
  {
    applicationVersionId: "OST",
    datasetId: "OST",
    sourceVersion: "OST",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-ost-strong.jsonl"
  },
  {
    applicationVersionId: "FMAR",
    datasetId: "FMAR",
    sourceVersion: "FMAR",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-fmar-strong.jsonl"
  },
  {
    applicationVersionId: "NVS78P",
    datasetId: "NVS78P",
    sourceVersion: "NVS78P",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-nvs78p-strong.jsonl"
  },
  {
    applicationVersionId: "NEG79",
    datasetId: "NEG79",
    sourceVersion: "NEG79",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-neg79-strong.jsonl"
  },
  {
    applicationVersionId: "NBS",
    datasetId: "NBS",
    sourceVersion: "NBS",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-nbs-strong.jsonl"
  },
  {
    applicationVersionId: "LSG",
    datasetId: "LSG",
    sourceVersion: "SG1910",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-sg1910-strong.jsonl"
  },
  {
    applicationVersionId: "DBY",
    datasetId: "DBY",
    sourceVersion: "DARBY",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-darby-strong.jsonl"
  },
  {
    applicationVersionId: "DBR",
    datasetId: "DBYR",
    sourceVersion: "DARBYR",
    relativePath: "outputs/releases/strong-jsonl-v3/bible-darbyr-strong.jsonl"
  },
  {
    applicationVersionId: "KJV",
    datasetId: "KJV",
    sourceVersion: "KJV",
    relativePath: "outputs/imports/english-sword/mobile-jsonl/bible-kjv-strong.jsonl"
  },
  {
    applicationVersionId: "NASB2020",
    datasetId: "NASB2020",
    sourceVersion: "NASB",
    relativePath:
      "outputs/imports/english-sword/mobile-jsonl/bible-nasb2020-strong.jsonl"
  },
  {
    applicationVersionId: "NASB1995",
    datasetId: "NASB1995",
    sourceVersion: "NASB1995",
    relativePath:
      "outputs/imports/english-sword/mobile-jsonl/bible-nasb1995-strong.jsonl"
  },
  {
    applicationVersionId: "BSB",
    datasetId: "BSB",
    sourceVersion: "BSB",
    relativePath: "outputs/imports/english-sword/mobile-jsonl/bible-bsb-strong.jsonl"
  },
  {
    applicationVersionId: "ASV",
    datasetId: "ASV",
    sourceVersion: "ASV",
    relativePath: "outputs/imports/english-sword/mobile-jsonl/bible-asv-strong.jsonl"
  },
  {
    applicationVersionId: "DARBY",
    datasetId: "DARBY_EN",
    sourceVersion: "Darby",
    relativePath:
      "outputs/imports/english-sword/mobile-jsonl/bible-darby-en-strong.jsonl"
  },
  {
    applicationVersionId: "RLT",
    datasetId: "RLT",
    sourceVersion: "RLT",
    relativePath: "outputs/imports/english-sword/mobile-jsonl/bible-rlt-strong.jsonl"
  },
  {
    applicationVersionId: "RWEBSTER",
    datasetId: "RWEBSTER",
    sourceVersion: "RWebster",
    relativePath:
      "outputs/imports/english-sword/mobile-jsonl/bible-rwebster-strong.jsonl"
  },
  {
    applicationVersionId: "RV1895",
    datasetId: "RV1895",
    sourceVersion: "RV_th",
    relativePath:
      "outputs/imports/english-sword/mobile-jsonl/bible-rv1895-strong.jsonl"
  }
] as const satisfies readonly MobileStrongBibleSource[];

interface ReverseCatalog extends Omit<MobileStrongBibleCatalog, "format"> {
  format: "bible-strong-reverse-interlinear-mobile-publications";
  stepDependency: {
    schemaVersion: number;
    textRevision: string;
    textSha256: string;
    tokenCount: number;
    compatibleRuntimes: Array<{
      language: "fr" | "en";
      file: string;
      sha256: string;
    }>;
  };
  bibles: Array<
    MobileStrongBibleCatalog["bibles"][number] & {
      language: "fr" | "en";
      strong: MobileStrongBibleCatalog["bibles"][number]["strong"] & {
        baseStrongRevision: string;
        baseContentBytes: number;
        addedContentBytes: number;
        contentIncreaseRatio: number;
        reverseInterlinear: ReverseInterlinearMetrics;
        sanitizationAudit?: {
          file: string;
          sha256: string;
          bytes: number;
          summary: Omit<StrongSanitizationAudit, "byStrong">;
        };
      };
    }
  >;
}

export async function packageReverseInterlinearStrongBibles(
  options: {
    root?: string;
    outputDir?: string;
    generatedAt?: string;
    sources?: readonly MobileStrongBibleSource[];
  } = {}
) {
  const root = path.resolve(options.root ?? process.cwd());
  const outputDir = path.resolve(
    root,
    options.outputDir ?? DEFAULT_REVERSE_INTERLINEAR_RELEASE
  );
  if (existsSync(outputDir)) {
    throw new Error(`reverse-interlinear-release-already-exists:${outputDir}`);
  }
  const workingDir = `${outputDir}.work-${process.pid}-${randomUUID()}`;
  const stepDir = path.join(
    root,
    "outputs/releases/bible-step-interlinear-runtime-v4"
  );
  const ledgerPath = path.join(
    root,
    "outputs/releases/bible-step-interlinear-ledger-v2/bible-step-interlinear-en.sqlite"
  );

  try {
    await packageMobileStrongBibles({
      root,
      outputDir: workingDir,
      generatedAt: options.generatedAt,
      sources: options.sources ?? REVERSE_INTERLINEAR_BIBLE_SOURCES
    });
    const stepCatalog = JSON.parse(
      await readFile(path.join(stepDir, "catalog.json"), "utf8")
    ) as {
      schemaVersion: number;
      textRevision: string;
      textSha256: string;
      counts: { tokens: number };
      artifacts: Array<{ file: string; sha256: string }>;
    };
    const runtimeArtifacts = {
      fr: requireArtifact(stepCatalog, "bible-step-interlinear-fr.sqlite"),
      en: requireArtifact(stepCatalog, "bible-step-interlinear-en.sqlite")
    };
    const step = loadReverseInterlinearStepIndex({
      ledgerPath,
      runtimePath: path.join(stepDir, runtimeArtifacts.en.file),
      runtimeSha256: runtimeArtifacts.en.sha256,
      compatibleRuntimeSha256s: [
        runtimeArtifacts.fr.sha256,
        runtimeArtifacts.en.sha256
      ],
      textRevision: stepCatalog.textRevision,
      textSha256: stepCatalog.textSha256
    });
    if (step.tokenCount !== stepCatalog.counts.tokens) {
      throw new Error(
        `reverse-step-token-count-mismatch:${step.tokenCount}:${stepCatalog.counts.tokens}`
      );
    }

    const baseCatalog = JSON.parse(
      await readFile(path.join(workingDir, "catalog.json"), "utf8")
    ) as MobileStrongBibleCatalog;
    const buildDir = path.join(workingDir, ".reverse-build");
    await mkdir(buildDir, { recursive: true });
    const bibles: ReverseCatalog["bibles"] = [];

    for (const bible of baseCatalog.bibles) {
      const bibleBuildDir = path.join(
        buildDir,
        bible.applicationVersionId.toLowerCase()
      );
      await mkdir(bibleBuildDir, { recursive: true });
      const strongArchivePath = path.join(workingDir, bible.strong.file);
      await execFileAsync("unzip", ["-q", strongArchivePath, "-d", bibleBuildDir]);
      const strongPath = path.join(bibleBuildDir, bible.strong.entry);
      const result = augmentStrongBibleWithReverseInterlinear({
        sqlitePath: strongPath,
        step,
        carrierPolicy: isOverTaggedEnglishBible(bible.applicationVersionId)
          ? "semantic-over-tagged"
          : "strong-order",
        sanitizeClassicalStrong: isOverTaggedEnglishBible(
          bible.applicationVersionId
        )
      });
      await validateAugmentedSqlite(
        strongPath,
        step.tokenCount,
        result.metrics.sourceLinkCount,
        !isFrenchBible(bible.applicationVersionId),
        result.sanitizationAudit
      );
      let sanitizationArtifact:
        | {
            file: string;
            sha256: string;
            bytes: number;
            summary: Omit<StrongSanitizationAudit, "byStrong">;
          }
        | undefined;
      if (result.sanitizationAudit) {
        const auditFile = `audits/${bible.applicationVersionId.toLowerCase()}-strong-sanitization.json`;
        const auditPath = path.join(workingDir, auditFile);
        await mkdir(path.dirname(auditPath), { recursive: true });
        await writeFile(
          auditPath,
          `${JSON.stringify(
            {
              format: "bible-strong-source-sanitization-audit",
              schemaVersion: 1,
              applicationVersionId: bible.applicationVersionId,
              datasetId: bible.datasetId,
              sourceVersion: bible.sourceVersion,
              baseStrongRevision: result.baseStrongRevision,
              stepTextRevision: step.textRevision,
              ...result.sanitizationAudit
            },
            null,
            2
          )}\n`
        );
        const { byStrong: _byStrong, ...summary } =
          result.sanitizationAudit;
        sanitizationArtifact = {
          file: auditFile,
          sha256: await sha256File(auditPath),
          bytes: (await stat(auditPath)).size,
          summary
        };
      }
      await rm(strongArchivePath, { force: true });
      await createDeterministicZip({
        inputPath: strongPath,
        entryName: bible.strong.entry,
        archivePath: strongArchivePath,
        stagingRoot: path.join(bibleBuildDir, "zip")
      });
      const [contentStats, archiveStats] = await Promise.all([
        stat(strongPath),
        stat(strongArchivePath)
      ]);
      bibles.push({
        ...bible,
        language: isFrenchBible(bible.applicationVersionId) ? "fr" : "en",
        strong: {
          ...bible.strong,
          schemaVersion: REVERSE_INTERLINEAR_MOBILE_SCHEMA_VERSION,
          strongRevision: result.strongRevision,
          identityCount: result.identityCount,
          baseStrongRevision: result.baseStrongRevision,
          baseContentBytes: bible.strong.contentBytes,
          addedContentBytes: contentStats.size - bible.strong.contentBytes,
          contentIncreaseRatio: ratio(
            contentStats.size - bible.strong.contentBytes,
            bible.strong.contentBytes
          ),
          contentSha256: await sha256File(strongPath),
          contentBytes: contentStats.size,
          archiveSha256: await sha256File(strongArchivePath),
          archiveBytes: archiveStats.size,
          reverseInterlinear: result.metrics,
          ...(sanitizationArtifact
            ? { sanitizationAudit: sanitizationArtifact }
            : {})
        }
      });
      process.stdout.write(
        `${bible.applicationVersionId}: ${(result.metrics.visibleTargetCoverage * 100).toFixed(2)}%\n`
      );
    }

    const catalog: ReverseCatalog = {
      format: "bible-strong-reverse-interlinear-mobile-publications",
      schemaVersion: REVERSE_INTERLINEAR_MOBILE_SCHEMA_VERSION,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      stepDependency: {
        schemaVersion: stepCatalog.schemaVersion,
        textRevision: stepCatalog.textRevision,
        textSha256: stepCatalog.textSha256,
        tokenCount: step.tokenCount,
        compatibleRuntimes: [
          { language: "fr", ...runtimeArtifacts.fr },
          { language: "en", ...runtimeArtifacts.en }
        ]
      },
      bibles
    };
    await writeFile(
      path.join(workingDir, "catalog.json"),
      `${JSON.stringify(catalog, null, 2)}\n`
    );
    await writeFile(
      path.join(workingDir, "REPORT.md"),
      renderReport(catalog)
    );
    await rm(buildDir, { recursive: true, force: true });
    await writeChecksums(workingDir, catalog);
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(workingDir, outputDir);
    return {
      outputDir,
      bibleCount: bibles.length,
      frenchBibleCount: bibles.filter((bible) => bible.language === "fr").length,
      englishBibleCount: bibles.filter((bible) => bible.language === "en").length,
      catalogSha256: await sha256File(path.join(outputDir, "catalog.json"))
    };
  } catch (error) {
    await rm(workingDir, { recursive: true, force: true });
    throw error;
  }
}

function requireArtifact(
  catalog: { artifacts: Array<{ file: string; sha256: string }> },
  file: string
): { file: string; sha256: string } {
  const artifact = catalog.artifacts.find((candidate) => candidate.file === file);
  if (!artifact) throw new Error(`reverse-step-artifact-missing:${file}`);
  return artifact;
}

async function validateAugmentedSqlite(
  sqlitePath: string,
  stepTokenCount: number,
  expectedSourceLinkCount: number,
  requireEnrichedKinds: boolean,
  sanitizationAudit?: StrongSanitizationAudit
): Promise<void> {
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = database
      .prepare(
        `SELECT
           (SELECT count(*) FROM WordSpans) AS spans,
           (SELECT count(*) FROM WordSpans
             WHERE stepTokenId IS NOT NULL) AS primarySources,
           (SELECT count(*) FROM WordStepTokenExtras) AS extraSources,
           (SELECT count(*) FROM WordSpans
             WHERE stepTokenId IS NOT NULL
               AND (stepTokenId < 1 OR stepTokenId > ?)) AS invalidPrimaryIds,
           (SELECT count(*) FROM WordStepTokenExtras
             WHERE stepTokenId < 1 OR stepTokenId > ?) AS invalidStepIds,
           (SELECT count(*) FROM WordStepTokenExtras e
             JOIN WordSpans w
               ON w.verseId=e.verseId AND w.ordinal=e.targetOrdinal
            WHERE w.stepTokenId IS NULL) AS extrasWithoutPrimary,
           (SELECT count(*) FROM WordStrongCodes x
             JOIN StrongCodes c ON c.id=x.codeId WHERE c.kind=1) AS eStrongLinks,
           (SELECT count(*) FROM WordStrongCodes x
             JOIN StrongCodes c ON c.id=x.codeId WHERE c.kind=2) AS dStrongLinks,
           (SELECT count(*) FROM WordStrongCodes x
             JOIN StrongCodes c ON c.id=x.codeId WHERE c.kind=3) AS uStrongLinks`
      )
      .get(stepTokenCount, stepTokenCount) as {
      spans: number;
      primarySources: number;
      extraSources: number;
      invalidPrimaryIds: number;
      invalidStepIds: number;
      extrasWithoutPrimary: number;
      eStrongLinks: number;
      dStrongLinks: number;
      uStrongLinks: number;
    };
    if (
      row.primarySources + row.extraSources !== expectedSourceLinkCount ||
      row.invalidPrimaryIds !== 0 ||
      row.invalidStepIds !== 0 ||
      row.extrasWithoutPrimary !== 0 ||
      (requireEnrichedKinds &&
        (row.eStrongLinks === 0 ||
          row.dStrongLinks === 0 ||
          row.uStrongLinks === 0))
    ) {
      throw new Error(
        `reverse-interlinear-validation-failed:${JSON.stringify(row)}`
      );
    }
    if (sanitizationAudit) {
      const sanitizationRow = database
        .prepare(
          `SELECT
             (SELECT count(*) FROM WordStrongCodes x
               JOIN StrongCodes c ON c.id=x.codeId
              WHERE c.kind=0) AS classicalLinks,
             (SELECT count(*) FROM WordStrongCodes x
               JOIN StrongCodes c ON c.id=x.codeId
               JOIN WordSpans w
                 ON w.verseId=x.verseId AND w.ordinal=x.ordinal
               JOIN FrenchLexemes l ON l.id=w.lexemeId
              WHERE c.kind=0
                AND l.partOfSpeech IN (
                  'conj', 'conjunction', 'det', 'determiner', 'particle',
                  'prep', 'preposition', 'pron', 'pronoun'
                )) AS functionClassicalLinks,
             (SELECT value FROM ResourceMetadata
               WHERE key='strongSanitizationPolicy') AS policy`
        )
        .get() as {
        classicalLinks: number;
        functionClassicalLinks: number;
        policy: string | null;
      };
      if (
        sanitizationAudit.sourceCount !==
          sanitizationAudit.alignedKeptCount +
            sanitizationAudit.lexicalKeptCount +
            sanitizationAudit.suppressedCount ||
        sanitizationRow.classicalLinks !==
          sanitizationAudit.alignedKeptCount +
            sanitizationAudit.lexicalKeptCount ||
        sanitizationRow.functionClassicalLinks !== 0 ||
        sanitizationRow.policy !== sanitizationAudit.policy ||
        sanitizationAudit.suppressedCount <= 0
      ) {
        throw new Error(
          `strong-sanitization-validation-failed:${JSON.stringify({
            sanitizationRow,
            summary: {
              sourceCount: sanitizationAudit.sourceCount,
              alignedKeptCount: sanitizationAudit.alignedKeptCount,
              lexicalKeptCount: sanitizationAudit.lexicalKeptCount,
              suppressedCount: sanitizationAudit.suppressedCount
            }
          })}`
        );
      }
    }
  } finally {
    database.close();
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

async function writeChecksums(
  directory: string,
  catalog: ReverseCatalog
): Promise<void> {
  const files = [
    ...catalog.bibles.flatMap((bible) => [
      bible.canonical.file,
      bible.strong.file,
      ...(bible.strong.sanitizationAudit
        ? [bible.strong.sanitizationAudit.file]
        : [])
    ]),
    "catalog.json",
    "REPORT.md"
  ];
  const lines = await Promise.all(
    files.map(
      async (file) => `${await sha256File(path.join(directory, file))}  ${file}`
    )
  );
  await writeFile(path.join(directory, "SHA256SUMS"), `${lines.join("\n")}\n`);
}

function renderReport(catalog: ReverseCatalog): string {
  const totalBaseBytes = catalog.bibles.reduce(
    (total, bible) => total + bible.strong.baseContentBytes,
    0
  );
  const totalAddedBytes = catalog.bibles.reduce(
    (total, bible) => total + bible.strong.addedContentBytes,
    0
  );
  const rows = catalog.bibles
    .map((bible) => {
      const metrics = bible.strong.reverseInterlinear;
      const sanitization = bible.strong.sanitizationAudit?.summary;
      return `| ${bible.applicationVersionId} | ${bible.language} | ${metrics.visibleTargetSpanCount.toLocaleString("en-US")} | ${(metrics.visibleTargetCoverage * 100).toFixed(2)}% | ${sanitization ? sanitization.suppressedCount.toLocaleString("en-US") : "—"} | ${formatMebibytes(bible.strong.addedContentBytes)} | ${(bible.strong.contentIncreaseRatio * 100).toFixed(2)}% |`;
    })
    .join("\n");
  return `# Release des Bibles Strong avec interlinéaire inversé

- Révision STEP : \`${catalog.stepDependency.textRevision}\`
- Tokens STEP : ${catalog.stepDependency.tokenCount.toLocaleString("en-US")}
- Bibles: ${catalog.bibles.length}
- Schéma SQLite Strong : ${catalog.schemaVersion}
- Ajout SQLite moyen : ${formatMebibytes(totalAddedBytes / catalog.bibles.length)}
- Augmentation agrégée : ${(ratio(totalAddedBytes, totalBaseBytes) * 100).toFixed(2)}%

| Bible | Langue | Occurrences visibles | Résolues | Strong source masqués | Ajout SQLite | Augmentation |
|---|---:|---:|---:|---:|---:|---:|
${rows}

Chaque lien conservé pointe vers un identifiant concret du runtime STEP. Le lien
principal est stocké dans \`WordSpans.stepTokenId\`; seuls les liens supplémentaires
sont stockés dans \`WordStepTokenExtras\`. Une valeur principale nulle déclenche
le repli lexical par numéro Strong. Les métriques détaillées de résolution restent
dans le catalogue de release plutôt que d'être répétées dans chaque ligne SQLite.
Pour ASV et Darby EN, les Strong classiques sans preuve STEP ni correspondance
lexicale sont retirés du sidecar produit. Leur audit complet, avec compteurs par
Strong et échantillons, est publié sous \`audits/\`.
`;
}

function isFrenchBible(applicationVersionId: string): boolean {
  return new Set([
    "OST",
    "FMAR",
    "NVS78P",
    "NEG79",
    "NBS",
    "LSG",
    "DBY",
    "DBR"
  ]).has(applicationVersionId);
}

function isOverTaggedEnglishBible(applicationVersionId: string): boolean {
  return applicationVersionId === "ASV" || applicationVersionId === "DARBY";
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Number((numerator / denominator).toFixed(6));
}

function formatMebibytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mio`;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output-dir");
  const outputDir = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const englishOnly = args.includes("--english-only");
  const sources = englishOnly
    ? REVERSE_INTERLINEAR_BIBLE_SOURCES.filter(
        ({ applicationVersionId }) => !isFrenchBible(applicationVersionId)
      )
    : undefined;
  const result = await packageReverseInterlinearStrongBibles({
    outputDir,
    ...(sources ? { sources } : {})
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) await main();
