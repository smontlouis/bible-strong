#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeCommentaryContent } from "./commentary-links.mjs";
import { sha256 } from "./firestore.mjs";
import { writeHistoricalTranslationStore } from "./historical-translations.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(scriptDirectory, "..");

const entityNames = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["nbsp", " "],
  ["quot", '"'],
  ["ldquo", "“"],
  ["rdquo", "”"],
  ["lsquo", "‘"],
  ["rsquo", "’"],
  ["mdash", "—"],
  ["ndash", "–"],
  ["hellip", "…"],
  ["copy", "©"],
  ["reg", "®"],
  ["trade", "™"],
  ["Acirc", "Â"],
  ["acirc", "â"],
  ["Atilde", "Ã"],
  ["Aring", "Å"],
  ["Auml", "Ä"],
  ["Euml", "Ë"],
  ["aacute", "á"],
  ["cent", "¢"],
  ["sup1", "¹"],
  ["sup2", "²"],
  ["sup3", "³"],
  ["not", "¬"],
  ["brvbar", "¦"],
  ["pound", "£"],
  ["iexcl", "¡"],
  ["ordm", "º"],
  ["ordf", "ª"],
  ["shy", "\u00ad"],
  ["cedil", "¸"],
  ["raquo", "»"],
  ["laquo", "«"],
  ["yen", "¥"],
  ["curren", "¤"],
  ["frac14", "¼"],
  ["frac12", "½"],
  ["frac34", "¾"],
  ["acute", "´"],
  ["macr", "¯"],
  ["para", "¶"],
  ["deg", "°"],
  ["uml", "¨"]
]);

const decodeEntities = (value) => {
  let result = String(value ?? "");
  for (let pass = 0; pass < 2; pass += 1) {
    result = result.replace(
      /&(?:#x([0-9a-f]+)|#([0-9]+)|([a-z][a-z0-9]+));/gi,
      (entity, hexadecimal, decimal, name) => {
        if (hexadecimal)
          return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
        if (decimal) return String.fromCodePoint(Number(decimal));
        return (
          entityNames.get(name) ?? entityNames.get(name.toLowerCase()) ?? entity
        );
      }
    );
  }
  return result;
};

const repairKnownMojibake = (value) => {
  let repaired = value;
  for (let pass = 0; pass < 3; pass += 1) {
    repaired = repaired.replace(/[\u0080-\u00ff]{2,}/gu, (run) => {
      const decoded = Buffer.from(run, "latin1").toString("utf8");
      return decoded.includes("�") ? run : decoded;
    });
  }
  return repaired
    .replaceAll("â", "—")
    .replaceAll("â", "–")
    .replaceAll("â", "“")
    .replaceAll("â", "”")
    .replaceAll("â", "‘")
    .replaceAll("â", "’")
    .replaceAll("Â ", " ")
    .replaceAll("Â", "");
};

/**
 * The legacy HTML differs from the canonical OCR projection in presentation only: links,
 * tooltips, entities, mojibake and the repeated leading verse heading. This fingerprint removes
 * only those evidenced differences. It intentionally does not use fuzzy similarity.
 */
export const correspondenceText = (html, passage) => {
  const verse = String(passage ?? "").split("-")[2];
  const text = repairKnownMojibake(
    decodeEntities(
      String(html ?? "")
        // UTF-8 ē was twice decoded into three HTML-entity fragments in the snapshot.
        .replaceAll("&Atilde;&#132;&acirc;&#128;&#156;", "ē")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, " ")
    )
  )
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const withoutHeading =
    verse && verse !== "0"
      ? text.replace(new RegExp(`^${verse}(?:\\s*[-,]\\s*\\d+)*\\.\\s+`), "")
      : text;
  return withoutHeading
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
};

const compare = (left, right) =>
  String(left).localeCompare(String(right), "en", { numeric: true });

const groupBy = (values, keyOf) => {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
};

const validHash = (html, expected, label) => {
  const actual = sha256(html);
  if (expected !== actual)
    throw new Error(`Hash invalide pour ${label}: ${expected} != ${actual}`);
  return actual;
};

const legacyCandidate = (entry) => {
  validHash(
    entry.source.html,
    entry.source.sha256,
    `source historique ${entry.id}`
  );
  if (entry.translation)
    validHash(
      entry.translation.html,
      entry.translation.sha256,
      `traduction historique ${entry.id}`
    );
  return {
    id: String(entry.id),
    passage: entry.passage,
    sourceSha256: entry.source.sha256,
    sourceFingerprintSha256: sha256(
      correspondenceText(entry.source.html, entry.passage)
    ),
    translationSha256: entry.translation?.sha256 ?? null,
    translationIssues: [...(entry.translation?.quality?.issues ?? [])].sort(
      compare
    ),
    entry
  };
};

const publicCandidate = (candidate) => ({
  id: candidate.id,
  sourceSha256: candidate.sourceSha256,
  sourceFingerprintSha256: candidate.sourceFingerprintSha256,
  translationSha256: candidate.translationSha256,
  translationIssues: candidate.translationIssues
});

const normalizedHistoricalTranslation = (candidate, passage) => {
  if (!candidate.entry.translation) return null;
  const normalized = normalizeCommentaryContent({
    html: candidate.entry.translation.html,
    resourceId: "sdabc",
    language: "fr",
    passage
  });
  return {
    language: "fr",
    html: normalized.html,
    sha256: sha256(normalized.html),
    references: normalized.references,
    externalSources: normalized.externalSources
  };
};

export const structuredReferenceSequence = (html) =>
  [...String(html ?? "").matchAll(/\bdata-reference=(["'])(.*?)\1/giu)].map(
    (match) => match[2]
  );

const isNonLinguisticMarker = (html) =>
  decodeEntities(String(html ?? "").replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, "")
    .replace(/\*/gu, "*") === "*****";

export const buildCorrespondenceReport = ({
  canonicalEntries,
  legacyEntries,
  snapshotSha256
}) => {
  const general = canonicalEntries
    .filter(
      (entry) =>
        (entry.layer ?? entry.editorialKind) === "general-commentary" ||
        entry.editorialKind === "book-introduction"
    )
    .sort(
      (left, right) =>
        compare(left.passage, right.passage) || compare(left.id, right.id)
    );
  const supplements = canonicalEntries
    .filter(
      (entry) => (entry.layer ?? entry.editorialKind) === "egw-supplement"
    )
    .sort(
      (left, right) =>
        compare(left.passage, right.passage) || compare(left.id, right.id)
    );
  const legacy = legacyEntries
    .map(legacyCandidate)
    .sort(
      (left, right) =>
        compare(left.passage, right.passage) || compare(left.id, right.id)
    );
  const legacyByPassage = groupBy(legacy, (entry) => entry.passage);
  const certain = [];
  const ambiguous = [];
  const absent = [];
  const collisions = [];

  for (const entry of general) {
    const fingerprintSha256 = sha256(
      correspondenceText(entry.source.html, entry.passage)
    );
    const candidates = legacyByPassage.get(entry.passage) ?? [];
    const exact = candidates.filter(
      (candidate) => candidate.sourceFingerprintSha256 === fingerprintSha256
    );
    const base = {
      canonicalId: entry.id,
      passage: entry.passage,
      canonicalSourceSha256: entry.source.sha256,
      canonicalHtmlSha256: sha256(entry.source.html),
      sourceFingerprintSha256: fingerprintSha256
    };

    if (exact.length !== 1) {
      const reason =
        exact.length > 1
          ? "multiple-exact-source-candidates"
          : candidates.length
            ? "source-mismatch"
            : "no-historical-entry";
      const detail = {
        ...base,
        reason,
        candidates: candidates.map(publicCandidate)
      };
      if (exact.length > 1) collisions.push(detail);
      else if (candidates.length) ambiguous.push(detail);
      else absent.push(detail);
      continue;
    }

    const candidate = exact[0];
    if (!candidate.translationSha256) {
      absent.push({
        ...base,
        reason: "historical-translation-missing",
        candidate: publicCandidate(candidate)
      });
      continue;
    }
    if (candidate.translationIssues.length) {
      ambiguous.push({
        ...base,
        reason: "historical-translation-quality-issues",
        candidates: [publicCandidate(candidate)]
      });
      continue;
    }

    const historicalSourceReferences = structuredReferenceSequence(
      candidate.entry.source.html
    );
    const historicalTranslationReferences = structuredReferenceSequence(
      candidate.entry.translation.html
    );
    if (
      JSON.stringify(historicalSourceReferences) !==
      JSON.stringify(historicalTranslationReferences)
    ) {
      ambiguous.push({
        ...base,
        reason: "historical-reference-sequence-mismatch",
        historicalSourceReferences,
        historicalTranslationReferences,
        candidates: [publicCandidate(candidate)]
      });
      continue;
    }

    const normalizedTranslation = normalizedHistoricalTranslation(
      candidate,
      entry.passage
    );

    if (
      entry.translation &&
      entry.translation.sha256 !== normalizedTranslation.sha256
    ) {
      collisions.push({
        ...base,
        reason: "different-canonical-translation",
        canonicalTranslationSha256: entry.translation.sha256,
        normalizedTranslationSha256: normalizedTranslation.sha256,
        candidates: [publicCandidate(candidate)]
      });
      continue;
    }

    certain.push({
      ...base,
      legacyId: candidate.id,
      legacySourceSha256: candidate.sourceSha256,
      legacyTranslationSha256: candidate.translationSha256,
      translationSha256: normalizedTranslation.sha256,
      alreadyApplied: entry.translation?.sha256 === normalizedTranslation.sha256
    });
  }

  const missingSupplements = supplements.filter((entry) => !entry.translation);
  const egwMissing = missingSupplements
    .filter((entry) => !isNonLinguisticMarker(entry.source.html))
    .map((entry) => ({
      canonicalId: entry.id,
      passage: entry.passage,
      sourceSha256: entry.source.sha256,
      layer: "egw-supplement"
    }));
  const egwNonLinguisticMarkers = missingSupplements
    .filter((entry) => isNonLinguisticMarker(entry.source.html))
    .map((entry) => ({
      canonicalId: entry.id,
      passage: entry.passage,
      sourceSha256: entry.source.sha256,
      canonicalHtmlSha256: sha256(entry.source.html),
      translationSha256: sha256(entry.source.html),
      layer: "egw-supplement",
      value: "*****",
      action: "copy-mechanically"
    }));
  const canonicalDigestInput = general.map((entry) => ({
    id: entry.id,
    passage: entry.passage,
    sourceSha256: entry.source.sha256
  }));
  const legacyDigestInput = legacy.map((candidate) => ({
    id: candidate.id,
    passage: candidate.passage,
    sourceSha256: candidate.sourceSha256,
    translationSha256: candidate.translationSha256
  }));

  return {
    schemaVersion: 1,
    resourceId: "sdabc",
    policy: {
      correspondence:
        "same passage + one exact normalized-source fingerprint; no fuzzy matching",
      quality: "historical translations with audit issues are not applied",
      overwrite: "a different canonical translation is never overwritten"
    },
    hashes: {
      firestoreSnapshot: snapshotSha256,
      historicalEntries: sha256(JSON.stringify(legacyDigestInput)),
      canonicalGeneralSources: sha256(JSON.stringify(canonicalDigestInput))
    },
    provenance: {
      source: "Firestore verse-commentaries/commentaries-FR local snapshot",
      remoteReads: false,
      remoteWrites: false
    },
    summary: {
      canonicalGeneral: general.length,
      canonicalEgwSupplements: supplements.length,
      historicalEntries: legacy.length,
      historicalTranslated: legacy.filter((entry) => entry.translationSha256)
        .length,
      recoveredCertain: certain.length,
      alreadyApplied: certain.filter((entry) => entry.alreadyApplied).length,
      ambiguous: ambiguous.length,
      absent: absent.length,
      collisions: collisions.length,
      egwMissing: egwMissing.length,
      egwNonLinguisticMarkers: egwNonLinguisticMarkers.length
    },
    certain,
    ambiguous,
    absent,
    collisions,
    egwMissing,
    egwNonLinguisticMarkers
  };
};

export const applyCertainCorrespondences = ({
  canonicalEntries,
  legacyEntries,
  report
}) => {
  const legacyById = new Map(
    legacyEntries.map((entry) => [String(entry.id), entry])
  );
  const certainByCanonicalId = new Map(
    report.certain.map((item) => [item.canonicalId, item])
  );
  const mechanicalMarkersByCanonicalId = new Map(
    report.egwNonLinguisticMarkers.map((item) => [item.canonicalId, item])
  );
  let applied = 0;
  let unchanged = 0;
  let appliedHistorical = 0;
  let appliedMechanicalMarkers = 0;

  const entries = canonicalEntries.map((entry) => {
    const correspondence = certainByCanonicalId.get(entry.id);
    const mechanicalMarker = mechanicalMarkersByCanonicalId.get(entry.id);
    if (!correspondence && !mechanicalMarker) return entry;
    if (mechanicalMarker) {
      if (
        entry.source.sha256 !== mechanicalMarker.sourceSha256 ||
        sha256(entry.source.html) !== mechanicalMarker.canonicalHtmlSha256 ||
        !isNonLinguisticMarker(entry.source.html)
      ) {
        throw new Error(`Le marqueur EGW a changé : sdabc/${entry.id}`);
      }
      if (entry.translation) {
        if (entry.translation.sha256 !== mechanicalMarker.translationSha256) {
          throw new Error(
            `Refus d’écraser une traduction différente : sdabc/${entry.id}`
          );
        }
        unchanged += 1;
        return entry;
      }
      applied += 1;
      appliedMechanicalMarkers += 1;
      return {
        ...entry,
        translation: {
          language: "fr",
          html: entry.source.html,
          sha256: mechanicalMarker.translationSha256,
          provenance:
            "Copie mécanique du marqueur non linguistique EGW depuis la source canonique"
        }
      };
    }
    const historical = legacyById.get(correspondence.legacyId);
    if (!historical?.translation)
      throw new Error(
        `Traduction historique absente : ${correspondence.legacyId}`
      );
    if (
      entry.source.sha256 !== correspondence.canonicalSourceSha256 ||
      sha256(entry.source.html) !== correspondence.canonicalHtmlSha256
    ) {
      throw new Error(`La source canonique a changé : sdabc/${entry.id}`);
    }
    validHash(
      historical.translation.html,
      correspondence.legacyTranslationSha256,
      `traduction historique ${historical.id}`
    );
    const normalized = normalizeCommentaryContent({
      html: historical.translation.html,
      resourceId: "sdabc",
      language: "fr",
      passage: entry.passage
    });
    validHash(
      normalized.html,
      correspondence.translationSha256,
      `traduction normalisée ${historical.id}`
    );
    if (entry.translation) {
      if (entry.translation.sha256 !== correspondence.translationSha256) {
        throw new Error(
          `Refus d’écraser une traduction différente : sdabc/${entry.id}`
        );
      }
      unchanged += 1;
      return entry;
    }
    applied += 1;
    appliedHistorical += 1;
    return {
      ...entry,
      translation: {
        language: "fr",
        html: normalized.html,
        sha256: correspondence.translationSha256,
        provenance: `Firestore commentaries-FR snapshot ${report.hashes.firestoreSnapshot}; legacy ${historical.id}; source ${historical.source.sha256}`,
        ...(normalized.references.length
          ? { references: normalized.references }
          : {}),
        ...(normalized.externalSources.length
          ? { externalSources: normalized.externalSources }
          : {})
      }
    };
  });
  return {
    entries,
    applied,
    unchanged,
    appliedHistorical,
    appliedMechanicalMarkers
  };
};

const parseArguments = (argv) => {
  const options = {
    snapshotRoot: path.join(workflowRoot, ".local/firestore-sdabc-export"),
    libraryRoot: path.join(workflowRoot, ".local/library"),
    reportPath: path.join(
      workflowRoot,
      ".local/sdabc-firestore-correspondence-report.json"
    ),
    historicalStoreRoot: null,
    apply: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--snapshot")
      options.snapshotRoot = path.resolve(argv[++index]);
    else if (argument === "--library")
      options.libraryRoot = path.resolve(argv[++index]);
    else if (argument === "--report")
      options.reportPath = path.resolve(argv[++index]);
    else if (argument === "--historical-store")
      options.historicalStoreRoot = path.resolve(argv[++index]);
    else if (argument === "--apply") options.apply = true;
    else if (argument === "--help") options.help = true;
    else throw new Error(`Argument inconnu : ${argument}`);
  }
  return options;
};

const usage =
  `Usage: node scripts/import-sdabc-firestore-translations.mjs [options]\n\n` +
  `Par défaut, produit seulement un rapport local déterministe.\n\n` +
  `  --snapshot <dossier>  Export Firestore local\n` +
  `  --library <dossier>   Bibliothèque JSON locale\n` +
  `  --report <fichier>    Rapport JSON local\n` +
  `  --historical-store <dossier>  Écrire le magasin versionné historical-import\n` +
  `  --apply               Appliquer les seules correspondances certaines\n` +
  `  --help                Afficher cette aide\n`;

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const loadLibrary = async (libraryRoot) => {
  const index = await readJson(path.join(libraryRoot, "index.json"));
  const chunks = [];
  for (const chapter of index.chapters) {
    const descriptor = chapter.resources.sdabc;
    if (!descriptor) continue;
    const chunkPath = path.join(libraryRoot, descriptor.path);
    const serialized = await readFile(chunkPath, "utf8");
    if (sha256(serialized) !== descriptor.sha256)
      throw new Error(`Hash de chunk invalide : ${descriptor.path}`);
    const document = JSON.parse(serialized);
    chunks.push({ descriptor, chunkPath, document });
  }
  return {
    index,
    chunks,
    entries: chunks.flatMap((chunk) => chunk.document.entries)
  };
};

const run = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  const [manifest, legacyEntries, library] = await Promise.all([
    readJson(path.join(options.snapshotRoot, "manifest.json")),
    readJson(path.join(options.snapshotRoot, "comments/sdabc.json")),
    loadLibrary(options.libraryRoot)
  ]);
  if (
    manifest.outputContainsRemoteSnapshot !== true ||
    manifest.remoteWrites !== false
  ) {
    throw new Error(
      "Le manifeste ne décrit pas un snapshot Firestore local en lecture seule"
    );
  }
  const snapshotSha256 = manifest.resources?.sdabc?.contentSha256;
  if (
    !snapshotSha256 ||
    sha256(JSON.stringify(legacyEntries)) !== snapshotSha256
  ) {
    throw new Error("Hash du snapshot Firestore SDABC invalide");
  }
  const report = buildCorrespondenceReport({
    canonicalEntries: library.entries,
    legacyEntries,
    snapshotSha256
  });
  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);

  let historicalStore = null;
  if (options.historicalStoreRoot) {
    const legacyById = new Map(
      legacyEntries.map((entry) => [String(entry.id), entry])
    );
    const canonicalById = new Map(
      library.entries.map((entry) => [entry.id, entry])
    );
    const historicalEntries = report.certain.map((correspondence) => {
      const legacyEntry = legacyById.get(correspondence.legacyId);
      if (!legacyEntry) {
        throw new Error(
          `Entrée historique absente : ${correspondence.legacyId}`
        );
      }
      if (!canonicalById.has(correspondence.canonicalId)) {
        throw new Error(
          `Entrée canonique absente : ${correspondence.canonicalId}`
        );
      }
      const historical = legacyCandidate(legacyEntry);
      const normalized = normalizedHistoricalTranslation(
        historical,
        correspondence.passage
      );
      return {
        id: correspondence.canonicalId,
        passage: correspondence.passage,
        sourceSha256: correspondence.canonicalSourceSha256,
        historicalId: correspondence.legacyId,
        historicalSourceSha256: correspondence.legacySourceSha256,
        translatedHtml: normalized.html,
        translationSha256: normalized.sha256,
        ...(normalized.references.length
          ? { references: normalized.references }
          : {}),
        ...(normalized.externalSources.length
          ? { externalSources: normalized.externalSources }
          : {})
      };
    });
    historicalStore = await writeHistoricalTranslationStore({
      root: options.historicalStoreRoot,
      resourceId: "sdabc",
      snapshotSha256,
      entries: historicalEntries
    });
  }

  let application = null;
  if (options.apply) {
    let applied = 0;
    let unchanged = 0;
    let appliedHistorical = 0;
    let appliedMechanicalMarkers = 0;
    for (const chunk of library.chunks) {
      const result = applyCertainCorrespondences({
        canonicalEntries: chunk.document.entries,
        legacyEntries,
        report
      });
      chunk.document.entries = result.entries;
      applied += result.applied;
      unchanged += result.unchanged;
      appliedHistorical += result.appliedHistorical;
      appliedMechanicalMarkers += result.appliedMechanicalMarkers;
    }
    for (const chunk of library.chunks) {
      const serialized = JSON.stringify(chunk.document);
      await writeFile(chunk.chunkPath, serialized);
      chunk.descriptor.sha256 = sha256(serialized);
      chunk.descriptor.count = chunk.document.entries.length;
    }
    const translated = library.chunks
      .flatMap((chunk) => chunk.document.entries)
      .filter((entry) => entry.translation).length;
    library.index.resources.sdabc.translatedCount = translated;
    library.index.resources.sdabc.missingCount =
      library.index.resources.sdabc.entryCount - translated;
    library.index.resources.sdabc.translatedAnchorCount = translated;
    library.index.sourceRevision.sdabcHistoricalTranslations = {
      snapshotSha256,
      reportSha256: sha256(JSON.stringify(report))
    };
    await writeFile(
      path.join(options.libraryRoot, "index.json"),
      `${JSON.stringify(library.index, null, 2)}\n`
    );
    application = {
      applied,
      unchanged,
      appliedHistorical,
      appliedMechanicalMarkers
    };
  }
  process.stdout.write(
    `${JSON.stringify({ report: options.reportPath, summary: report.summary, historicalStore, application }, null, 2)}\n`
  );
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
