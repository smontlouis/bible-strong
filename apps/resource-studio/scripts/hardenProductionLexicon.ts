import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_SOURCE = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_CORE_OUTPUT = "data/dictionaries/strong_lexicon.core.production.sqlite";
const DEFAULT_FULL_OUTPUT = "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_REPORT = "reports/lexicon-production-hardening.md";

type MorphologyCodeRow = {
  id: number;
  code: string;
  normalizedCode: string;
  language: string;
  scope: string;
  example: string;
  meaning: string;
  description: string;
  source: string;
};

type DbStatRow = {
  name: string;
  bytes: number;
};

type ProductionCounts = {
  stepEntries: number;
  lexiconTranslations: number;
  morphologyCodes: number;
  morphologyCodeTranslations: number;
  lexiconResources?: number;
  lexiconResourceTranslations?: number;
};

type ProductionSummary = {
  path: string;
  bytes: number;
  gzipBytes: number;
  integrity: string;
  counts: ProductionCounts;
  stats: DbStatRow[];
};

type TranslationRow = {
  morphologyCodeId: number;
  language: string;
  meaning: string;
  description: string;
  example: string;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolve(args.source ?? DEFAULT_SOURCE);
  const coreOutputPath = resolve(args.coreOutput ?? DEFAULT_CORE_OUTPUT);
  const fullOutputPath = resolve(args.fullOutput ?? DEFAULT_FULL_OUTPUT);
  const reportPath = resolve(args.report ?? DEFAULT_REPORT);

  if (!existsSync(sourcePath)) {
    throw new Error(`Source database not found: ${sourcePath}`);
  }

  mkdirSync(dirname(coreOutputPath), { recursive: true });
  mkdirSync(dirname(fullOutputPath), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });

  const backupPath = createBackup(sourcePath);
  const sourceBeforeBytes = statSync(sourcePath).size;

  hardenSourceDb(sourcePath);
  runSql(sourcePath, "VACUUM;");

  const sourceAfterBytes = statSync(sourcePath).size;
  buildProductionDb(sourcePath, coreOutputPath, "core");
  buildProductionDb(sourcePath, fullOutputPath, "full");

  const coreSummary = summarizeProductionDb(coreOutputPath, false);
  const fullSummary = summarizeProductionDb(fullOutputPath, true);
  const sourceIntegrity = runScalar(sourcePath, "PRAGMA integrity_check;");

  writeFileSync(
    reportPath,
    renderReport({
      sourcePath,
      backupPath,
      sourceBeforeBytes,
      sourceAfterBytes,
      sourceIntegrity,
      core: coreSummary,
      full: fullSummary
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        sourcePath,
        backupPath,
        reportPath,
        sourceIntegrity,
        sourceBeforeBytes,
        sourceAfterBytes,
        core: pickSummary(coreSummary),
        full: pickSummary(fullSummary)
      },
      null,
      2
    )
  );
}

function hardenSourceDb(dbPath: string): void {
  const morphologyCodes = runJson<MorphologyCodeRow>(
    dbPath,
    `
      SELECT id, code, normalizedCode, language, scope, example, meaning, description, source
      FROM MorphologyCodes
      ORDER BY id
    `
  );

  const rows = morphologyCodes.map(buildMorphologyTranslation);
  runSql(
    dbPath,
    `
      CREATE TABLE IF NOT EXISTS MorphologyCodeTranslations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        morphologyCodeId INTEGER NOT NULL,
        language TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT NOT NULL,
        example TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(morphologyCodeId, language),
        FOREIGN KEY(morphologyCodeId) REFERENCES MorphologyCodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_MorphologyCodeTranslations_language
        ON MorphologyCodeTranslations(language);
      CREATE INDEX IF NOT EXISTS idx_MorphologyCodeTranslations_code
        ON MorphologyCodeTranslations(morphologyCodeId);

      DELETE FROM MorphologyCodeTranslations WHERE language = 'fr';
      ${buildMorphologyInsertSql(rows)}

      UPDATE LexiconTranslations
      SET gloss = 'si : sinon', updatedAt = ${sqlString(new Date().toISOString())}
      WHERE language = 'fr' AND stepEntryId = 1534 AND gloss = 'if : else';

      UPDATE LexiconTranslations
      SET gloss = 'Beaux-Ports', updatedAt = ${sqlString(new Date().toISOString())}
      WHERE language = 'fr' AND stepEntryId = 2670 AND gloss = 'Fair (Havens)';

      UPDATE LexiconTranslations
      SET gloss = 'seigneur : maître', updatedAt = ${sqlString(new Date().toISOString())}
      WHERE language = 'fr' AND stepEntryId = 3068 AND gloss = 'lord : maître';

      UPDATE LexiconTranslations
      SET gloss = 'YHWH / l''Éternel', updatedAt = ${sqlString(new Date().toISOString())}
      WHERE language = 'fr' AND stepEntryId IN (15113, 15149) AND gloss = 'LORD';

      INSERT OR REPLACE INTO DictionaryMeta (key, value)
      VALUES
        ('hardenedAt', ${sqlString(new Date().toISOString())}),
        ('hardenedProfile', 'fr-production-hardening-v1'),
        ('morphologyTranslations', 'fr');
    `
  );
}

function buildProductionDb(
  sourcePath: string,
  outputPath: string,
  profile: "core" | "full"
): void {
  if (existsSync(outputPath)) rmSync(outputPath);

  const includeResources = profile === "full";
  runSql(
    sourcePath,
    `
      ATTACH ${sqlString(outputPath)} AS out;
      PRAGMA out.foreign_keys = OFF;
      PRAGMA out.page_size = 4096;
      PRAGMA out.journal_mode = OFF;
      PRAGMA out.synchronous = OFF;

      CREATE TABLE out.StepEntries (
        id INTEGER PRIMARY KEY,
        language TEXT NOT NULL,
        baseCode INTEGER NOT NULL,
        eStrong TEXT NOT NULL,
        dStrong TEXT NOT NULL,
        uStrong TEXT NOT NULL,
        original TEXT NOT NULL,
        transliteration TEXT NOT NULL,
        morph TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        classicTransliteration TEXT NOT NULL DEFAULT '',
        pronunciation TEXT NOT NULL DEFAULT '',
        UNIQUE(language, eStrong, dStrong, uStrong)
      );

      INSERT INTO out.StepEntries
      SELECT
        id, language, baseCode, eStrong, dStrong, uStrong, original,
        transliteration, morph, gloss, meaning, classicTransliteration, pronunciation
      FROM main.StepEntries;

      CREATE TABLE out.LexiconTranslations (
        stepEntryId INTEGER NOT NULL,
        language TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        meaningHtml TEXT NOT NULL,
        UNIQUE(stepEntryId, language)
      );

      INSERT INTO out.LexiconTranslations
        (stepEntryId, language, gloss, meaning, meaningHtml)
      SELECT stepEntryId, language, gloss, meaning, meaningHtml
      FROM main.LexiconTranslations;

      CREATE TABLE out.MorphologyCodes (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL,
        normalizedCode TEXT NOT NULL,
        language TEXT NOT NULL,
        scope TEXT NOT NULL,
        example TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        UNIQUE(source, scope, code)
      );

      INSERT INTO out.MorphologyCodes
      SELECT id, code, normalizedCode, language, scope, example, meaning, description, source
      FROM main.MorphologyCodes;

      CREATE TABLE out.MorphologyCodeTranslations (
        morphologyCodeId INTEGER NOT NULL,
        language TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT NOT NULL,
        example TEXT NOT NULL,
        PRIMARY KEY(morphologyCodeId, language)
      ) WITHOUT ROWID;

      INSERT INTO out.MorphologyCodeTranslations
        (morphologyCodeId, language, meaning, description, example)
      SELECT morphologyCodeId, language, meaning, description, example
      FROM main.MorphologyCodeTranslations;

      CREATE TABLE out.DictionaryMeta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;

      INSERT INTO out.DictionaryMeta (key, value)
      SELECT key, value
      FROM main.DictionaryMeta;

      INSERT OR REPLACE INTO out.DictionaryMeta (key, value)
      VALUES
        ('productionGeneratedAt', ${sqlString(new Date().toISOString())}),
        ('productionProfile', ${sqlString(`strong-lexicon-${profile}-v1`)}),
        ('removedColumns', ${sqlString(
          includeResources
            ? "translation ids, createdAt, updatedAt"
            : "LexiconResources, LexiconResourceTranslations, translation ids, createdAt, updatedAt"
        )});

      ${includeResources ? resourceProductionSql() : ""}

      CREATE INDEX out.idx_StepEntries_language_baseCode
        ON StepEntries(language, baseCode);
      CREATE INDEX out.idx_StepEntries_eStrong
        ON StepEntries(eStrong);
      CREATE INDEX out.idx_MorphologyCodes_code
        ON MorphologyCodes(code);
      CREATE INDEX out.idx_MorphologyCodes_normalizedCode
        ON MorphologyCodes(normalizedCode);
      CREATE INDEX out.idx_MorphologyCodes_scope
        ON MorphologyCodes(scope);

      DETACH out;
    `
  );

  runSql(outputPath, "VACUUM;");
}

function resourceProductionSql(): string {
  return `
    CREATE TABLE out.LexiconResources (
      id INTEGER PRIMARY KEY,
      stepEntryId INTEGER NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      contentHtml TEXT NOT NULL,
      UNIQUE(stepEntryId, source, kind)
    );

    INSERT INTO out.LexiconResources
    SELECT id, stepEntryId, source, kind, contentHtml
    FROM main.LexiconResources;

    CREATE TABLE out.LexiconResourceTranslations (
      resourceId INTEGER NOT NULL,
      language TEXT NOT NULL,
      contentHtml TEXT NOT NULL,
      contentText TEXT NOT NULL,
      UNIQUE(resourceId, language)
    );

    INSERT INTO out.LexiconResourceTranslations
      (resourceId, language, contentHtml, contentText)
    SELECT resourceId, language, contentHtml, contentText
    FROM main.LexiconResourceTranslations;

    CREATE INDEX out.idx_LexiconResources_stepEntryId
      ON LexiconResources(stepEntryId);
    CREATE INDEX out.idx_LexiconResources_source_kind
      ON LexiconResources(source, kind);
  `;
}

function buildMorphologyTranslation(row: MorphologyCodeRow): TranslationRow {
  const meaning =
    row.scope === "tagged_full"
      ? buildStructuredMeaning(row)
      : translateBriefMeaning(row.meaning);
  return {
    morphologyCodeId: row.id,
    language: "fr",
    meaning,
    description:
      row.scope === "tagged_full"
        ? buildStructuredDescription(row)
        : translateBriefDescription(row.description),
    example:
      row.scope === "tagged_full"
        ? `Exemple morphologique : ${meaning}.`
        : translateBriefExample(row.example)
  };
}

function translateBriefDescription(value: string): string {
  const text = value.trim();
  if (!text) return "";

  return translateMorphologyText(text)
    .replace(/Function=/g, "Fonction=")
    .replace(/Stem=/g, "Thème=")
    .replace(/Action=/g, "Action=")
    .replace(/Voice=/g, "Voix=")
    .replace(/Form=/g, "Forme=")
    .replace(/Tense=/g, "Temps=")
    .replace(/Mood=/g, "Mode=")
    .replace(/Person=/g, "Personne=")
    .replace(/Gender=/g, "Genre=")
    .replace(/Number=/g, "Nombre=")
    .replace(/State=/g, "État=")
    .replace(/\bhence\b/g, "donc")
    .replace(/\bby male people or things\b/g, "par des personnes ou choses masculines")
    .replace(/\bby female people or things\b/g, "par des personnes ou choses féminines")
    .replace(/\bby male or female people or things\b/g, "par des personnes ou choses de genre commun")
    .replace(/\bbeing discussed\b/g, "dont on parle")
    .replace(/\bbeing addressed\b/g, "auxquelles on s'adresse")
    .replace(/\bthat is speaking or writing this\b/g, "qui parle ou écrit")
    .replace(/\bACTION OR ACTIVITY\b/g, "ACTION OU ACTIVITÉ")
    .replace(/\bis done\b/g, "est faite")
    .replace(/\bdone\b/g, "faite")
    .replace(/\bin the past or present\b/g, "dans le passé ou le présent")
    .replace(/\bin the future or present\b/g, "dans le futur ou le présent")
    .replace(/\bcompletely\b/g, "complètement")
    .replace(/\bincompletely\b/g, "incomplètement")
    .replace(/\burgently\b/g, "urgemment")
    .replace(/\bmust or should be\b/g, "doit ou devrait être")
    .replace(/\bto or for themselves\b/g, "à eux-mêmes ou pour eux-mêmes")
    .replace(/\bto or for themself\b/g, "à soi-même ou pour soi-même")
    .replace(/\bto or for himself\b/g, "à lui-même ou pour lui-même")
    .replace(/\bto or for herself\b/g, "à elle-même ou pour elle-même")
    .replace(/\s+/g, " ")
    .trim();
}

function translateBriefExample(value: string): string {
  if (!value) return "";
  const exactExamples: Record<string, string> = {
    "who was, and who is and who will be":
      "celui qui était, qui est et qui sera",
    I: "je",
    you: "tu/vous",
    he: "il",
    my: "mon/ma",
    your: "ton/ta",
    his: "son",
    "#MeToo": "#MoiAussi",
    Grace: "Grâce",
    North: "Nord",
    Egyptian: "Égyptien",
    Britishly: "à la manière britannique",
    German: "Allemand",
    Gentile: "Gentil",
    Pharaoh: "Pharaon"
  };
  if (exactExamples[value]) return exactExamples[value];

  return translateMorphologyText(value)
    .replace(/\bhow\?/g, "comment ?")
    .replace(/\bto lord\b/g, "être seigneur")
    .replace(/\bCome lord\b/g, "viens, Seigneur")
    .replace(/\blord\b/g, "seigneur")
    .replace(/\bthoughtful\b/g, "réfléchi")
    .replace(/\bthoughtfully\b/g, "avec réflexion")
    .replace(/\bthought\b/g, "pensée")
    .replace(/\bbetter\b/g, "meilleur")
    .replace(/\bbest\b/g, "le meilleur")
    .replace(/\bfastest\b/g, "le plus vite")
    .replace(/\bfaster\b/g, "plus vite")
    .replace(/\bfast\b/g, "vite")
    .replace(/\btrue\b/g, "vrai")
    .replace(/\blest\b/g, "de peur que")
    .replace(/\bten\b/g, "dix")
    .replace(/\bwhere\b/g, "où")
    .replace(/\beach other\b/g, "l'un l'autre")
    .replace(/\bthe\b/g, "le/la/les")
    .replace(/\bif not also\b/g, "sinon aussi")
    .replace(/\bif not\b/g, "sinon")
    .replace(/\bif\b/g, "si")
    .replace(/\band\b/g, "et")
    .replace(/\bneither\b/g, "ni")
    .replace(/\bnor not\b/g, "ni non")
    .replace(/\bnor\b/g, "ni")
    .replace(/\bnot never\b/g, "jamais non")
    .replace(/\bnot\b/g, "non")
    .replace(/\bhow much\?/g, "combien ?")
    .replace(/\bthis\b/g, "ceci")
    .replace(/\bwhat\b/g, "quoi")
    .replace(/\bHey!\b/g, "Hé !")
    .replace(/\bwoman\b/g, "femme")
    .replace(/\bfemale\b/g, "féminin")
    .replace(/\bman\b/g, "homme")
    .replace(/\bperson\b/g, "personne")
    .replace(/\bdog\b/g, "chien")
    .replace(/\bcow\b/g, "vache")
    .replace(/\bgreen\b/g, "vert")
    .replace(/\bup\b/g, "haut")
    .replace(/\byou\b/g, "tu/vous")
    .replace(/\bhe\b/g, "il")
    .replace(/\bmyself\b/g, "moi-même")
    .replace(/\byouself\b/g, "toi-même")
    .replace(/\bhimself\b/g, "lui-même")
    .replace(/\bthat\b/g, "que")
    .replace(/\bthink\b/g, "penser")
    .replace(/\bwith\b/g, "avec")
    .replace(/\bclose\b/g, "près")
    .replace(/\bnear\b/g, "proche")
    .replace(/\bmy\b/g, "mon/ma")
    .replace(/\byour\b/g, "ton/ta")
    .replace(/\bhis\b/g, "son")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStructuredMeaning(row: MorphologyCodeRow): string {
  const fields = extractMorphologyFields(row.description);
  const fallback = translateMorphologyText(row.meaning);
  if (fields.length === 0) return fallback;

  const ordered = sortFields(fields)
    .filter((field) => field.key !== "Action")
    .map((field) => translateFieldValue(field.value))
    .filter(Boolean);

  return ordered.length > 0
    ? sentenceCase(dedupe(ordered).join(" "))
    : fallback;
}

function buildStructuredDescription(row: MorphologyCodeRow): string {
  const fields = extractMorphologyFields(row.description);
  if (fields.length === 0) return translateBriefDescription(row.description);

  return sortFields(fields)
    .map(
      (field) =>
        `${translateFieldLabel(field.key)} : ${translateFieldValue(field.value)}`
    )
    .join("; ");
}

function extractMorphologyFields(
  description: string
): Array<{ key: string; value: string }> {
  const fields: Array<{ key: string; value: string }> = [];
  const pattern =
    /(Function|Case|Number|Gender|Extra|Name type|Adj\.Numb\.|Form|Stem|Action|Voice|Tense|Mood|Person|State)=([^;()"]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(description)) !== null) {
    const [, key, value] = match;
    if (!key || !value) continue;
    fields.push({ key, value: value.trim() });
  }
  return fields;
}

function sortFields(
  fields: Array<{ key: string; value: string }>
): Array<{ key: string; value: string }> {
  const order = [
    "Function",
    "Stem",
    "Action",
    "Voice",
    "Form",
    "Tense",
    "Mood",
    "Case",
    "Person",
    "Gender",
    "Number",
    "State",
    "Adj.Numb.",
    "Name type",
    "Extra"
  ];
  return [...fields].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function translateFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    Function: "Fonction",
    Stem: "Thème",
    Action: "Action",
    Voice: "Voix",
    Form: "Forme",
    Tense: "Temps",
    Mood: "Mode",
    Case: "Cas",
    Person: "Personne",
    Gender: "Genre",
    Number: "Nombre",
    State: "État",
    "Name type": "Type de nom",
    "Adj.Numb.": "Type numéral",
    Extra: "Précision"
  };
  return labels[key] ?? key;
}

function translateFieldValue(value: string): string {
  const cleaned = value
    .replace(
      /\s+(DESCRIBING|causing|reflecting|a reference|a generalising reference|a question|QUESTIONING|SPECIFIC|the NAME|important|the numerical position|performing|intensifying)\b.*$/i,
      ""
    )
    .replace(/\s+that\b.*$/i, "")
    .replace(/\s+of\.\.\.$/i, "")
    .trim();

  return translateMorphologyText(cleaned)
    .replace(/\bCommon\b/g, "commun")
    .replace(/\bNumerical position\b/g, "ordinal")
    .replace(/\bNumerical\b/g, "numéral")
    .replace(/\bLocation\b/g, "lieu")
    .replace(/\bIndividual\b/g, "individu")
    .replace(/\bContracted form\b/g, "forme contractée")
    .replace(/\s+/g, " ")
    .trim();
}

function translateBriefMeaning(value: string): string {
  return translateMorphologyText(value)
    .replace(/\bDemonstrativePronoun\b/g, "pronom démonstratif")
    .replace(/\bIntjection\b/g, "interjection")
    .replace(/\bInterogative\b/g, "interrogatif")
    .replace(/\bLetter\b/g, "lettre")
    .replace(/\bPersonal pronom\b/g, "pronom personnel")
    .replace(/\bPossessive pronom\b/g, "pronom possessif")
    .replace(/\bIndefinite pronom\b/g, "pronom indéfini")
    .replace(/\bProper Name\b/g, "nom propre")
    .replace(/\bProper nom\b/g, "nom propre")
    .replace(/\bCorrelative\b/g, "corrélatif")
    .replace(/\bJOINED TO\b/g, "JOINT À")
    .replace(/\b1st person\b/g, "première personne")
    .replace(/\b2nd person\b/g, "deuxième personne")
    .replace(/\b3rd person\b/g, "troisième personne")
    .replace(/\bof a Location\b/g, "de lieu")
    .replace(/\bof a Person\b/g, "de personne")
    .replace(/\bof some kind\b/g, "d'un certain type")
    .replace(/\bwith no stated gender\b/g, "sans genre indiqué")
    .replace(/\bwith no gender\b/g, "sans genre")
    .replace(/\bin Gentilic sense\b/g, "au sens gentilé")
    .replace(/\bie not the name of a person or place\b/g, "c.-à-d. ni personne ni lieu")
    .replace(/\bupper case for other than a person or place\b/g, "majuscule hors personne ou lieu")
    .replace(/\bgrec pronom personnel\b/g, "pronom personnel grec")
    .replace(/\bgrec pronom possessif\b/g, "pronom possessif grec")
    .replace(/\bgrec pronom réfléchi\b/g, "pronom réfléchi grec")
    .replace(/\bgrec pronom relatif\b/g, "pronom relatif grec")
    .replace(/\bgrec pronom indéfini\b/g, "pronom indéfini grec")
    .replace(/\bgrec particule\b/g, "particule grecque")
    .replace(/\bgrec négatif\b/g, "négation grecque")
    .replace(/\bnom grec propre\b/g, "nom propre grec")
    .replace(/\bIndéclinable propre nom\b/g, "nom propre indéclinable")
    .replace(/\bnom propre adjectif\b/g, "adjectif de nom propre")
    .replace(/\bor\b/g, "ou")
    .replace(/\bof\b/g, "de")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function sentenceCase(value: string): string {
  return value.length === 0 ? value : value[0]?.toUpperCase() + value.slice(1);
}

function translateMorphologyText(value: string): string {
  let text = value;
  const replacements: Array<[RegExp, string]> = [
    [/\bAramaic Interogative\b/g, "interrogatif araméen"],
    [/\bAramaic Noun\b/g, "nom araméen"],
    [/\bAramaic Verb\b/g, "verbe araméen"],
    [/\bGreek Adjective\b/g, "adjectif grec"],
    [/\bGreek Adverb\b/g, "adverbe grec"],
    [/\bGreek Article\b/g, "article grec"],
    [/\bGreek Conditional\b/g, "conditionnel grec"],
    [/\bGreek Conjunction\b/g, "conjonction grecque"],
    [/\bGreek Number\b/g, "nombre grec"],
    [/\bGreek Preposition\b/g, "préposition grecque"],
    [/\bGreek Verb\b/g, "verbe grec"],
    [/\bGreek Noun\b/g, "nom grec"],
    [/\bHebrew Adjective\b/g, "adjectif hébreu"],
    [/\bHebrew Adverb\b/g, "adverbe hébreu"],
    [/\bHebrew Article\b/g, "article hébreu"],
    [/\bHebrew Conjunction\b/g, "conjonction hébraïque"],
    [/\bHebrew Noun\b/g, "nom hébreu"],
    [/\bHebrew Preposition\b/g, "préposition hébraïque"],
    [/\bHebrew Verb\b/g, "verbe hébreu"],
    [/\bConjunction\+Imperfect\b/g, "conjonction + imparfait"],
    [/\bConsecutive Imperfect\b/g, "imparfait consécutif"],
    [/\bConsecutive Perfect\b/g, "parfait consécutif"],
    [/\bPossessive pronoun\b/g, "pronom possessif"],
    [/\bPersonal pronoun\b/g, "pronom personnel"],
    [/\bIndefinite pronoun\b/g, "pronom indéfini"],
    [/\bCorrelative or Interrogative pronoun\b/g, "pronom corrélatif ou interrogatif"],
    [/\bCorrelative pronoun\b/g, "pronom corrélatif"],
    [/\bDefinite article\b/g, "article défini"],
    [/\bObject suffix\b/g, "suffixe objet"],
    [/\bObject indicator\b/g, "marqueur d'objet"],
    [/\bNumerical position Adjective\b/g, "adjectif ordinal"],
    [/\bNumerical Adjective\b/g, "adjectif numéral"],
    [/\bRelative Pronoun\b/g, "pronom relatif"],
    [/\bReciprocal Pronoun\b/g, "pronom réciproque"],
    [/\bReflexive Pronoun\b/g, "pronom réfléchi"],
    [/\bDemonstrative Pronoun\b/g, "pronom démonstratif"],
    [/\bInterrogative Pronoun\b/g, "pronom interrogatif"],
    [/\bRelative pronoun\b/g, "pronom relatif"],
    [/\bReciprocal pronoun\b/g, "pronom réciproque"],
    [/\bReflexive pronoun\b/g, "pronom réfléchi"],
    [/\bDemonstrative pronoun\b/g, "pronom démonstratif"],
    [/\bInterrogative pronoun\b/g, "pronom interrogatif"],
    [/\bConditional Particle\b/g, "particule conditionnelle"],
    [/\bDemonstrative Particle\b/g, "particule démonstrative"],
    [/\bInterrogative Particle\b/g, "particule interrogative"],
    [/\bNegative Particle\b/g, "particule négative"],
    [/\bDisjunctive Particle\b/g, "particule disjonctive"],
    [/\bDirectional Suffix\b/g, "suffixe directionnel"],
    [/\bParagogic Hé\b/g, "hé paragogique"],
    [/\bParagogic Nun\b/g, "noun paragogique"],
    [/\bTitle Gentilic\b/g, "titre gentilé"],
    [/\bTranscribed from Aramaic\b/g, "transcrit de l'araméen"],
    [/\bIntensive\/resultive\/transtive\b/g, "intensif/résultatif/transitif"],
    [/\bCausative\/declarative\b/g, "causatif/déclaratif"],
    [/\bReflexive\/iterative\b/g, "réfléchi/itératif"],
    [/\bFuture\/present\b/g, "futur/présent"],
    [/\bPast\/present\b/g, "passé/présent"],
    [/\bPresent\/future\b/g, "présent/futur"],
    [/\bIndicative\/jussive\b/g, "indicatif/jussif"],
    [/\bEither gender\b/g, "genre commun"],
    [/\b1st\b/g, "première personne"],
    [/\b2nd\b/g, "deuxième personne"],
    [/\b3rd\b/g, "troisième personne"],
    [/\bFirst\b/g, "première"],
    [/\bSecond\b/g, "deuxième"],
    [/\bThird\b/g, "troisième"],
    [/\bSingular\b/g, "singulier"],
    [/\bPlural\b/g, "pluriel"],
    [/\bDual\b/g, "duel"],
    [/\bMasculine\b/g, "masculin"],
    [/\bFeminine\b/g, "féminin"],
    [/\bNeuter\b/g, "neutre"],
    [/\bNominative\b/g, "nominatif"],
    [/\bGenitive\b/g, "génitif"],
    [/\bDative\b/g, "datif"],
    [/\bAccusative\b/g, "accusatif"],
    [/\bVocative\b/g, "vocatif"],
    [/\bAbsolute\b/g, "absolu"],
    [/\bConstruct\b/g, "construit"],
    [/\bDefinite\b/g, "défini"],
    [/\bComparative\b/g, "comparatif"],
    [/\bSuperlative\b/g, "superlatif"],
    [/\bIndeclinable\b/g, "indéclinable"],
    [/\bImperative\b/g, "impératif"],
    [/\bIndicative\b/g, "indicatif"],
    [/\bJussive\b/g, "jussif"],
    [/\bParticiple\b/g, "participe"],
    [/\bImperfect\b/g, "imparfait"],
    [/\bPerfect\b/g, "parfait"],
    [/\bPassive\b/g, "passif"],
    [/\bActive\b/g, "actif"],
    [/\bMiddle\b/g, "moyen"],
    [/\bSimple\b/g, "simple"],
    [/\bAdjective\b/g, "adjectif"],
    [/\bAdverb\b/g, "adverbe"],
    [/\bArticle\b/g, "article"],
    [/\bConjunction\b/g, "conjonction"],
    [/\bPreposition\b/g, "préposition"],
    [/\bInterjection\b/g, "interjection"],
    [/\bParticle\b/g, "particule"],
    [/\bPronoun\b/g, "pronom"],
    [/\bNumber\b/g, "nombre"],
    [/\bVerb\b/g, "verbe"],
    [/\bNoun\b/g, "nom"],
    [/\bAramaic\b/g, "araméen"],
    [/\bGreek\b/g, "grec"],
    [/\bHebrew\b/g, "hébreu"],
    [/\bProper Name\b/g, "nom propre"],
    [/\bProper\b/g, "propre"],
    [/\bLocation\b/g, "lieu"],
    [/\bName\b/g, "nom"],
    [/\bSPECIFIC\b/g, "spécifique"],
    [/\bQUESTIONING\b/g, "interrogatif"],
    [/\bGentilic\b/g, "gentilé"],
    [/\bTitle\b/g, "titre"],
    [/\bPerson\b/g, "personne"],
    [/\bCommon\b/g, "commun"],
    [/\bNegative\b/g, "négatif"],
    [/\bConditional\b/g, "conditionnel"],
    [/\bInterrogative\b/g, "interrogatif"],
    [/\bOR\b/g, "OU"],
    [/\bWITH\b/g, "AVEC"]
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, " ").trim();
}

function buildMorphologyInsertSql(rows: TranslationRow[]): string {
  if (rows.length === 0) return "";
  const now = new Date().toISOString();
  const values = rows
    .map((row) =>
      [
        row.morphologyCodeId,
        sqlString(row.language),
        sqlString(row.meaning),
        sqlString(row.description),
        sqlString(row.example),
        sqlString(now),
        sqlString(now)
      ].join(", ")
    )
    .map((value) => `(${value})`);

  const chunks: string[] = [];
  for (let index = 0; index < values.length; index += 400) {
    chunks.push(`
      INSERT INTO MorphologyCodeTranslations
        (morphologyCodeId, language, meaning, description, example, createdAt, updatedAt)
      VALUES
        ${values.slice(index, index + 400).join(",\n        ")};
    `);
  }
  return chunks.join("\n");
}

function summarizeProductionDb(
  path: string,
  includeResources: boolean
): ProductionSummary {
  const counts = productionCounts(path, includeResources);
  return {
    path,
    bytes: statSync(path).size,
    gzipBytes: gzipSize(path),
    integrity: runScalar(path, "PRAGMA integrity_check;"),
    counts,
    stats: dbStats(path)
  };
}

function productionCounts(
  dbPath: string,
  includeResources: boolean
): ProductionCounts {
  const resourceSql = includeResources
    ? `,
        (SELECT count(*) FROM LexiconResources) AS lexiconResources,
        (SELECT count(*) FROM LexiconResourceTranslations) AS lexiconResourceTranslations`
    : "";
  const [row] = runJson<ProductionCounts>(
    dbPath,
    `
      SELECT
        (SELECT count(*) FROM StepEntries) AS stepEntries,
        (SELECT count(*) FROM LexiconTranslations) AS lexiconTranslations,
        (SELECT count(*) FROM MorphologyCodes) AS morphologyCodes,
        (SELECT count(*) FROM MorphologyCodeTranslations) AS morphologyCodeTranslations
        ${resourceSql}
    `
  );
  if (!row) throw new Error(`Failed to count production DB: ${dbPath}`);
  return row;
}

function dbStats(dbPath: string): DbStatRow[] {
  return runJson<DbStatRow>(
    dbPath,
    `
      SELECT name, SUM(pgsize) AS bytes
      FROM dbstat
      GROUP BY name
      ORDER BY bytes DESC
    `
  );
}

function gzipSize(dbPath: string): number {
  const output = execFileSync("gzip", ["-c", "-9", dbPath], {
    maxBuffer: 1024 * 1024 * 200
  });
  return output.byteLength;
}

function createBackup(dbPath: string): string {
  const backupPath = `${dbPath}.backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  copyFileSync(dbPath, backupPath);
  return resolve(backupPath);
}

function pickSummary(summary: ProductionSummary): Record<string, unknown> {
  return {
    path: summary.path,
    bytes: summary.bytes,
    gzipBytes: summary.gzipBytes,
    integrity: summary.integrity,
    counts: summary.counts
  };
}

function renderReport(input: {
  sourcePath: string;
  backupPath: string;
  sourceBeforeBytes: number;
  sourceAfterBytes: number;
  sourceIntegrity: string;
  core: ProductionSummary;
  full: ProductionSummary;
}): string {
  return `# Strong Lexicon Production Hardening

Generated: ${new Date().toISOString()}

## Source

- Source: \`${input.sourcePath}\`
- Backup: \`${input.backupPath}\`
- Integrity: \`${input.sourceIntegrity}\`
- Before: ${input.sourceBeforeBytes} bytes (${formatBytes(input.sourceBeforeBytes)})
- After: ${input.sourceAfterBytes} bytes (${formatBytes(input.sourceAfterBytes)})

## Changes Applied

- Added \`MorphologyCodeTranslations\` with French rows for every morphology code.
- Normalized visible French glosses still carrying English UI text:
  - \`if : else\` -> \`si : sinon\`
  - \`Fair (Havens)\` -> \`Beaux-Ports\`
  - \`lord : maître\` -> \`seigneur : maître\`
  - \`LORD\` -> \`YHWH / l'Éternel\`
- Built two production SQLite profiles:
  - core: Strong lexicon + FR translations + morphology, no TFLSJ extended resources.
  - full: core plus TFLSJ source and FR resource translations.

## Production Files

| Profile | Path | Integrity | Bytes | Size | gzip -9 |
| --- | --- | --- | ---: | ---: | ---: |
| Core | \`${input.core.path}\` | \`${input.core.integrity}\` | ${input.core.bytes} | ${formatBytes(input.core.bytes)} | ${formatBytes(input.core.gzipBytes)} |
| Full | \`${input.full.path}\` | \`${input.full.integrity}\` | ${input.full.bytes} | ${formatBytes(input.full.bytes)} | ${formatBytes(input.full.gzipBytes)} |

## Counts

| Profile | StepEntries | LexiconTranslations | MorphologyCodes | MorphologyCodeTranslations | LexiconResources | LexiconResourceTranslations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Core | ${input.core.counts.stepEntries} | ${input.core.counts.lexiconTranslations} | ${input.core.counts.morphologyCodes} | ${input.core.counts.morphologyCodeTranslations} | 0 | 0 |
| Full | ${input.full.counts.stepEntries} | ${input.full.counts.lexiconTranslations} | ${input.full.counts.morphologyCodes} | ${input.full.counts.morphologyCodeTranslations} | ${input.full.counts.lexiconResources ?? 0} | ${input.full.counts.lexiconResourceTranslations ?? 0} |

## Core Table Sizes

${renderStats(input.core.stats)}

## Full Table Sizes

${renderStats(input.full.stats)}
`;
}

function renderStats(stats: DbStatRow[]): string {
  const rows = stats
    .map(
      (row) =>
        `| ${row.name} | ${row.bytes} | ${formatBytes(row.bytes)} |`
    )
    .join("\n");
  return `| Object | Bytes | Size |
| --- | ---: | ---: |
${rows}`;
}

function runSql(dbPath: string, sql: string): void {
  execFileSync("sqlite3", [dbPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 300
  });
}

function runJson<T>(dbPath: string, sql: string): T[] {
  const raw = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200
  });
  return JSON.parse(raw || "[]") as T[];
}

function runScalar(dbPath: string, sql: string): string {
  return execFileSync("sqlite3", [dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  }).trim();
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    const key = rawKey.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[key] = nextValue;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

main();
