import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface EntityName {
  significance: string;
  uniqueName: string;
  dStrong: string;
  eStrong: string;
  original: string;
  displayName: string;
  stepBibleLink: string;
  refsText: string;
  rawJson: string;
}

interface EntityRelation {
  relation: string;
  toUniqueName: string;
  certainty: string;
}

interface EntityRef {
  book: string;
  chapter: number;
  verse: number;
  suffix: string;
  refText: string;
}

interface Entity {
  uniqueName: string;
  uStrong: string;
  displayName: string;
  category: "person" | "group" | "place" | "other";
  type: string;
  description: string;
  summaryHtml: string;
  briefest: string;
  brief: string;
  shortDescription: string;
  articleHtml: string;
  openBibleName: string;
  googleMapUrl: string;
  palopenmapsUrl: string;
  latitude: string;
  longitude: string;
  area: string;
  rawHeader: string;
  rawJson: string;
  names: EntityName[];
  relations: EntityRelation[];
  refs: EntityRef[];
}

interface JsonStrong {
  dStrong?: string;
  eStrong?: string;
  nameInOriginalLanguage?: string;
}

interface JsonSupplementaryData {
  recordType?: string;
  unifiedName?: string;
  strongs?: JsonStrong[];
  stepBibleLink?: string;
  englishTransliterationOfName?: string;
  whereFound?: string[];
}

interface JsonRelation {
  augmentedUnifiedName?: string;
  ambiguous?: boolean;
}

interface PersonJson {
  baseNameFromUnifiedName?: string;
  referenceFromUnifiedName?: string;
  dStrongs?: string;
  description?: string;
  father?: JsonRelation;
  mother?: JsonRelation;
  siblings?: JsonRelation[];
  partners?: JsonRelation[];
  offspring?: JsonRelation[];
  tribeOrNationOfFather?: string;
  summaryDescription?: string;
  type?: string;
  briefestDescription?: string;
  briefDescription?: string;
  shortDescription?: string;
  longDescription?: string;
  supplementaryData?: JsonSupplementaryData[];
}

interface PlaceJson {
  unifiedName?: string;
  baseNameFromUnifiedName?: string;
  referenceFromUnifiedName?: string;
  dStrongs?: string;
  openBibleName?: string;
  near?: string;
  founderOrOrigin?: string;
  peopleLivingThere?: string;
  googleMapsUrl?: string;
  palopenmapsUrl?: string;
  geographicalArea?: string;
  summaryDescription?: string;
  briefestDescription?: string;
  briefDescription?: string;
  shortDescription?: string;
  longDescription?: string;
  supplementaryData?: JsonSupplementaryData[];
}

const SOURCES = {
  tipnr: {
    localName: "TIPNR.txt",
    source: "TIPNR",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Proper%20Nouns/TIPNR%20-%20Translators%20Individualised%20Proper%20Names%20with%20all%20References%20-%20STEPBible.org%20CC%20BY.txt"
  },
  people: {
    localName: "tipnr-json/people.json",
    source: "TIPNR_JSON_PEOPLE",
    url: "https://drive.google.com/uc?export=download&id=1cLAdAbwo_iFhzp-UwTL8IYCLW-M15rh9"
  },
  places: {
    localName: "tipnr-json/places.json",
    source: "TIPNR_JSON_PLACES",
    url: "https://drive.google.com/uc?export=download&id=1sZAvzYfP5qG7TqmlJdMbxAytli3VUgkn"
  }
};

const DEFAULT_OUTPUT = "data/entities/bible_entities.sqlite";
const DEFAULT_CACHE_DIR = "data/external/stepbible";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(args.output ?? DEFAULT_OUTPUT);
  const cacheDir = path.resolve(args.cacheDir ?? DEFAULT_CACHE_DIR);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.join(cacheDir, "tipnr-json"), { recursive: true });

  const tipnrPath = path.join(cacheDir, SOURCES.tipnr.localName);
  const peoplePath = path.join(cacheDir, SOURCES.people.localName);
  const placesPath = path.join(cacheDir, SOURCES.places.localName);

  await downloadIfNeeded(SOURCES.tipnr.url, tipnrPath, args.refresh === "true");
  await downloadIfNeeded(
    SOURCES.people.url,
    peoplePath,
    args.refresh === "true"
  );
  await downloadIfNeeded(
    SOURCES.places.url,
    placesPath,
    args.refresh === "true"
  );

  const tipnrContent = await readFile(tipnrPath, "utf8");
  const peopleContent = await readFile(peoplePath, "utf8");
  const placesContent = await readFile(placesPath, "utf8");
  const people = loadJsonWithComments<PersonJson>(peopleContent);
  const places = loadJsonWithComments<PlaceJson>(placesContent);
  const entities = [
    ...parsePeopleJson(people),
    ...parsePlacesJson(places),
    ...parseOtherEntitiesFromTipnr(tipnrContent)
  ];
  const tempPath = `${outputPath}.tmp`;

  await rm(tempPath, { force: true });
  await rm(outputPath, { force: true });

  const sql = buildSql({
    entities,
    generatedAt: new Date().toISOString(),
    sourceDigests: {
      [SOURCES.tipnr.localName]: sha256(tipnrContent),
      [SOURCES.people.localName]: sha256(peopleContent),
      [SOURCES.places.localName]: sha256(placesContent)
    }
  });

  const result = spawnSync("sqlite3", [tempPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 30
  });

  if (result.status !== 0) {
    throw new Error(
      `sqlite3 failed with status ${result.status}\n${result.stderr}`
    );
  }

  await rename(tempPath, outputPath);

  const report = {
    output: outputPath,
    generatedAt: new Date().toISOString(),
    source: "STEPBible-Data TIPNR + TIPNR JSON people/places",
    license: "CC BY 4.0",
    attribution: "STEP Bible (https://www.stepbible.org/)",
    sourceDigests: {
      [SOURCES.tipnr.localName]: sha256(tipnrContent),
      [SOURCES.people.localName]: sha256(peopleContent),
      [SOURCES.places.localName]: sha256(placesContent)
    },
    counts: {
      entities: entities.length,
      personEntities: entities.filter((entity) => entity.category === "person")
        .length,
      groupEntities: entities.filter((entity) => entity.category === "group")
        .length,
      placeEntities: entities.filter((entity) => entity.category === "place")
        .length,
      otherEntities: entities.filter((entity) => entity.category === "other")
        .length,
      entityNames: entities.reduce(
        (total, entity) => total + entity.names.length,
        0
      ),
      entityRefs: entities.reduce(
        (total, entity) => total + entity.refs.length,
        0
      ),
      entityRelations: entities.reduce(
        (total, entity) => total + entity.relations.length,
        0
      )
    }
  };

  await writeFile(
    `${outputPath}.report.json`,
    `${JSON.stringify(report, null, 2)}\n`
  );

  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${outputPath}.report.json`);
  console.log(JSON.stringify(report.counts, null, 2));
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[i + 1];

    if (inlineValue !== undefined) {
      parsed[toCamelCase(rawKey)] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[toCamelCase(rawKey)] = nextValue;
      i += 1;
    } else {
      parsed[toCamelCase(rawKey)] = "true";
    }
  }

  return parsed;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
}

async function downloadIfNeeded(
  url: string,
  destination: string,
  refresh: boolean
): Promise<void> {
  if (!refresh && existsSync(destination)) {
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  await writeFile(destination, await response.text());
}

function loadJsonWithComments<T>(content: string): Record<string, T> {
  const jsonText = content
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n")
    .trim();
  return JSON.parse(jsonText) as Record<string, T>;
}

function parsePeopleJson(people: Record<string, PersonJson>): Entity[] {
  return Object.entries(people).map(([uniqueName, value]) => {
    const refs = uniqueRefs(
      (value.supplementaryData ?? []).flatMap((item) =>
        (item.whereFound ?? []).flatMap(parseRef)
      )
    );
    const names = namesFromSupplementaryData(value.supplementaryData ?? []);

    return {
      uniqueName,
      uStrong: cleanDash(value.dStrongs ?? ""),
      displayName:
        value.baseNameFromUnifiedName ?? displayNameFromUniqueName(uniqueName),
      category: value.type === "Group" ? "group" : "person",
      type: cleanDash(value.type ?? ""),
      description: cleanDash(value.description ?? ""),
      summaryHtml: cleanDash(value.summaryDescription ?? ""),
      briefest: cleanDash(value.briefestDescription ?? ""),
      brief: cleanDash(value.briefDescription ?? ""),
      shortDescription: cleanDash(value.shortDescription ?? ""),
      articleHtml: cleanDash(value.longDescription ?? ""),
      openBibleName: "",
      googleMapUrl: "",
      palopenmapsUrl: "",
      latitude: "",
      longitude: "",
      area: cleanDash(value.tribeOrNationOfFather ?? ""),
      rawHeader: "",
      rawJson: JSON.stringify(value),
      names,
      relations: [
        ...relationFromSingle("father", value.father),
        ...relationFromSingle("mother", value.mother),
        ...relationsFromArray("sibling", value.siblings),
        ...relationsFromArray("partner", value.partners),
        ...relationsFromArray("offspring", value.offspring)
      ],
      refs
    };
  });
}

function parsePlacesJson(places: Record<string, PlaceJson>): Entity[] {
  return Object.entries(places).map(([uniqueName, value]) => {
    const googleMapUrl = cleanDash(value.googleMapsUrl ?? "");
    const coords = googleMapUrl.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/u);
    const refs = uniqueRefs(
      (value.supplementaryData ?? []).flatMap((item) =>
        (item.whereFound ?? []).flatMap(parseRef)
      )
    );

    return {
      uniqueName,
      uStrong: cleanDash(value.dStrongs ?? ""),
      displayName:
        value.baseNameFromUnifiedName ?? displayNameFromUniqueName(uniqueName),
      category: "place",
      type: "Place",
      description: cleanDash(value.near ?? ""),
      summaryHtml: cleanDash(value.summaryDescription ?? ""),
      briefest: cleanDash(value.briefestDescription ?? ""),
      brief: cleanDash(value.briefDescription ?? ""),
      shortDescription: cleanDash(value.shortDescription ?? ""),
      articleHtml: cleanDash(value.longDescription ?? ""),
      openBibleName: cleanDash(value.openBibleName ?? ""),
      googleMapUrl,
      palopenmapsUrl: cleanDash(value.palopenmapsUrl ?? ""),
      latitude: coords?.[1] ?? "",
      longitude: coords?.[2] ?? "",
      area: cleanDash(value.geographicalArea ?? ""),
      rawHeader: "",
      rawJson: JSON.stringify(value),
      names: namesFromSupplementaryData(value.supplementaryData ?? []),
      relations: [
        ...parseRelationField("founder_or_origin", value.founderOrOrigin ?? ""),
        ...parseRelationField("resident", value.peopleLivingThere ?? "")
      ],
      refs
    };
  });
}

function namesFromSupplementaryData(
  supplementaryData: JsonSupplementaryData[]
): EntityName[] {
  const names: EntityName[] = [];

  for (const item of supplementaryData) {
    const strongs = item.strongs?.length ? item.strongs : [{}];
    const refsText = (item.whereFound ?? []).join("; ");

    for (const strong of strongs) {
      names.push({
        significance: cleanDash(item.recordType ?? ""),
        uniqueName: cleanDash(item.unifiedName ?? ""),
        dStrong: cleanDash(strong.dStrong ?? ""),
        eStrong: cleanDash(strong.eStrong ?? ""),
        original: cleanDash(strong.nameInOriginalLanguage ?? ""),
        displayName: cleanDash(item.englishTransliterationOfName ?? ""),
        stepBibleLink: cleanDash(item.stepBibleLink ?? ""),
        refsText,
        rawJson: JSON.stringify(item)
      });
    }
  }

  return names;
}

function relationFromSingle(
  relation: string,
  value: JsonRelation | undefined
): EntityRelation[] {
  return relationFromJsonValue(relation, value);
}

function relationsFromArray(
  relation: string,
  values: JsonRelation[] | undefined
): EntityRelation[] {
  return (values ?? []).flatMap((value) =>
    relationFromJsonValue(relation, value)
  );
}

function relationFromJsonValue(
  relation: string,
  value: JsonRelation | undefined
): EntityRelation[] {
  const toUniqueName = cleanDash(value?.augmentedUnifiedName ?? "");
  if (!toUniqueName || !toUniqueName.includes("@")) {
    return [];
  }
  return [
    {
      relation,
      toUniqueName,
      certainty: value?.ambiguous ? "uncertain" : "asserted"
    }
  ];
}

function parseOtherEntitiesFromTipnr(content: string): Entity[] {
  const lines = content.replace(/^\uFEFF/u, "").split(/\r?\n/);
  const records: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isTipnrEntityHeader(line)) {
      if (current.length > 0) {
        records.push(current);
      }
      current = [line];
      continue;
    }

    if (current.length > 0 && isRecordContinuation(line)) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    records.push(current);
  }

  return records
    .filter((record) => isOtherRecord(record[0] ?? ""))
    .map(parseOtherEntityRecord);
}

function isOtherRecord(headerLine: string): boolean {
  const type = lastNonEmpty(splitCells(headerLine));
  return new Set([
    "Supernatural",
    "Time",
    "Musical",
    "Other",
    "Title",
    "Star",
    "Language"
  ]).has(type);
}

function isTipnrEntityHeader(line: string): boolean {
  return /^[^\t$–@‖*][^\t]*@[^\t]+=[GH]/u.test(line);
}

function isRecordContinuation(line: string): boolean {
  return (
    line.startsWith("–") ||
    line.startsWith("@Briefest=") ||
    line.startsWith("@Brief=") ||
    line.startsWith("@Short=") ||
    line.startsWith("@Article=")
  );
}

function parseOtherEntityRecord(lines: string[]): Entity {
  const header = splitCells(lines[0] ?? "");
  const uniqueNameWithStrong = header[0] ?? "";
  const { uniqueName, uStrong } =
    parseUniqueNameWithStrong(uniqueNameWithStrong);
  const names = lines
    .filter((line) => line.startsWith("–"))
    .map(parseEntityNameFromTsv)
    .filter((name): name is EntityName => name !== null);
  const refs = uniqueRefs(names.flatMap((name) => parseRefs(name.refsText)));
  const descriptionFields = parseDescriptionFields(lines);

  return {
    uniqueName,
    uStrong,
    displayName: displayNameFromUniqueName(uniqueName),
    category: "other",
    type: lastNonEmpty(header),
    description: header[1] ?? "",
    summaryHtml: header[7] ?? "",
    briefest: descriptionFields.briefest,
    brief: descriptionFields.brief,
    shortDescription: descriptionFields.shortDescription,
    articleHtml: descriptionFields.articleHtml,
    openBibleName: "",
    googleMapUrl: "",
    palopenmapsUrl: "",
    latitude: "",
    longitude: "",
    area: "",
    rawHeader: lines[0] ?? "",
    rawJson: "",
    names,
    relations: [],
    refs
  };
}

function splitCells(line: string): string[] {
  return line.split("\t").map(cleanCell);
}

function lastNonEmpty(values: string[]): string {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value) {
      return value;
    }
  }
  return "";
}

function parseUniqueNameWithStrong(value: string): {
  uniqueName: string;
  uStrong: string;
} {
  const match = value.match(/^(.*?)=([GH]\d{4,5}[A-Z]?)$/u);
  return {
    uniqueName: match?.[1] ?? value,
    uStrong: match?.[2] ?? ""
  };
}

function displayNameFromUniqueName(uniqueName: string): string {
  return uniqueName.split("@")[0]?.split("|").pop() ?? uniqueName;
}

function parseDescriptionFields(lines: string[]): {
  briefest: string;
  brief: string;
  shortDescription: string;
  articleHtml: string;
} {
  const joined = lines.join("\n");
  return {
    briefest: extractDescriptionField(joined, "Briefest"),
    brief: extractDescriptionField(joined, "Brief"),
    shortDescription: extractDescriptionField(joined, "Short"),
    articleHtml: extractDescriptionField(joined, "Article")
  };
}

function extractDescriptionField(content: string, field: string): string {
  const nextFields = ["Briefest", "Brief", "Short", "Article"].filter(
    (candidate) => candidate !== field
  );
  const pattern = new RegExp(
    `@${field}=\\s*([\\s\\S]*?)(?=\\n@(?:${nextFields.join("|")})=|$)`,
    "u"
  );
  return cleanCell(pattern.exec(content)?.[1] ?? "");
}

function parseEntityNameFromTsv(line: string): EntityName | null {
  const fields = splitCells(line);
  const significance = fields[0]?.replace(/^–\s*/u, "") ?? "";
  if (significance === "Total" || fields.length < 4) {
    return null;
  }
  const strongParts = parseNameStrong(fields[2] ?? "");
  return {
    significance,
    uniqueName: fields[1] ?? "",
    dStrong: strongParts.dStrong,
    eStrong: strongParts.eStrong,
    original: strongParts.original,
    displayName: fields[3] ?? "",
    stepBibleLink: fields[4] ?? "",
    refsText: fields[5] ?? "",
    rawJson: ""
  };
}

function parseNameStrong(value: string): {
  dStrong: string;
  eStrong: string;
  original: string;
} {
  const [dStrong = "", rest = ""] = value.split("\u00AB");
  const [eStrong = "", original = ""] = rest.split("=");
  return { dStrong, eStrong, original };
}

function parseRelationField(relation: string, value: string): EntityRelation[] {
  return value
    .split(/[,+]/u)
    .map((part) => part.trim())
    .filter((part) => part.includes("@"))
    .map((part) => {
      const certainty = part.includes("(?)") ? "uncertain" : "asserted";
      const toUniqueName = part
        .replace(/=[GH]\d{4,5}[A-Z]?/gu, "")
        .replace(/\(\?\)/gu, "")
        .replace(/\([adf]\)/giu, "")
        .trim();
      return { relation, toUniqueName, certainty };
    });
}

function parseRefs(refsText: string): EntityRef[] {
  return refsText
    .split(";")
    .map((ref) => ref.trim())
    .flatMap(parseRef);
}

function parseRef(refText: string): EntityRef[] {
  const match = refText.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)([a-z]?)$/u);
  if (!match) {
    return [];
  }
  return [
    {
      book: match[1] ?? "",
      chapter: Number.parseInt(match[2] ?? "0", 10),
      verse: Number.parseInt(match[3] ?? "0", 10),
      suffix: match[4] ?? "",
      refText
    }
  ];
}

function uniqueRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  const unique: EntityRef[] = [];
  for (const ref of refs) {
    const key = `${ref.book}.${ref.chapter}.${ref.verse}.${ref.suffix}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(ref);
  }
  return unique;
}

function buildSql(input: {
  entities: Entity[];
  generatedAt: string;
  sourceDigests: Record<string, string>;
}): string {
  const statements: string[] = [
    "PRAGMA journal_mode = OFF;",
    "PRAGMA synchronous = OFF;",
    "PRAGMA foreign_keys = ON;",
    "BEGIN;",
    `CREATE TABLE Entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uniqueName TEXT NOT NULL UNIQUE,
      uStrong TEXT NOT NULL,
      displayName TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      summaryHtml TEXT NOT NULL,
      briefest TEXT NOT NULL,
      brief TEXT NOT NULL,
      shortDescription TEXT NOT NULL,
      articleHtml TEXT NOT NULL,
      rawHeader TEXT NOT NULL,
      rawJson TEXT NOT NULL,
      source TEXT NOT NULL
    );`,
    "CREATE INDEX idx_Entities_category ON Entities(category);",
    "CREATE INDEX idx_Entities_uStrong ON Entities(uStrong);",
    "CREATE INDEX idx_Entities_displayName ON Entities(displayName);",
    `CREATE TABLE EntityNames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityId INTEGER NOT NULL,
      significance TEXT NOT NULL,
      uniqueName TEXT NOT NULL,
      dStrong TEXT NOT NULL,
      eStrong TEXT NOT NULL,
      original TEXT NOT NULL,
      displayName TEXT NOT NULL,
      stepBibleLink TEXT NOT NULL,
      refsText TEXT NOT NULL,
      rawJson TEXT NOT NULL,
      FOREIGN KEY (entityId) REFERENCES Entities(id) ON DELETE CASCADE
    );`,
    "CREATE INDEX idx_EntityNames_entityId ON EntityNames(entityId);",
    "CREATE INDEX idx_EntityNames_dStrong ON EntityNames(dStrong);",
    "CREATE INDEX idx_EntityNames_eStrong ON EntityNames(eStrong);",
    `CREATE TABLE EntityRefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityId INTEGER NOT NULL,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      suffix TEXT NOT NULL,
      refText TEXT NOT NULL,
      FOREIGN KEY (entityId) REFERENCES Entities(id) ON DELETE CASCADE,
      UNIQUE(entityId, book, chapter, verse, suffix)
    );`,
    "CREATE INDEX idx_EntityRefs_ref ON EntityRefs(book, chapter, verse);",
    "CREATE INDEX idx_EntityRefs_entityId ON EntityRefs(entityId);",
    `CREATE TABLE EntityRelations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromEntityId INTEGER NOT NULL,
      relation TEXT NOT NULL,
      toUniqueName TEXT NOT NULL,
      toEntityId INTEGER,
      certainty TEXT NOT NULL,
      FOREIGN KEY (fromEntityId) REFERENCES Entities(id) ON DELETE CASCADE,
      FOREIGN KEY (toEntityId) REFERENCES Entities(id) ON DELETE SET NULL
    );`,
    "CREATE INDEX idx_EntityRelations_fromEntityId ON EntityRelations(fromEntityId);",
    "CREATE INDEX idx_EntityRelations_toEntityId ON EntityRelations(toEntityId);",
    `CREATE TABLE EntityPlaces (
      entityId INTEGER PRIMARY KEY,
      openBibleName TEXT NOT NULL,
      googleMapUrl TEXT NOT NULL,
      palopenmapsUrl TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      area TEXT NOT NULL,
      FOREIGN KEY (entityId) REFERENCES Entities(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE EntityMeta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );`,
    insertMeta("generatedAt", input.generatedAt),
    insertMeta("source", "STEPBible-Data TIPNR + TIPNR JSON people/places"),
    insertMeta("license", "CC BY 4.0"),
    insertMeta("attribution", "STEP Bible (https://www.stepbible.org/)"),
    insertMeta("sourceDigests", JSON.stringify(input.sourceDigests))
  ];

  for (const entity of input.entities) {
    const entityId = `(SELECT id FROM Entities WHERE uniqueName = ${sqlString(
      entity.uniqueName
    )})`;

    statements.push(
      `INSERT INTO Entities (uniqueName, uStrong, displayName, category, type, description, summaryHtml, briefest, brief, shortDescription, articleHtml, rawHeader, rawJson, source) VALUES (${[
        sqlString(entity.uniqueName),
        sqlString(entity.uStrong),
        sqlString(entity.displayName),
        sqlString(entity.category),
        sqlString(entity.type),
        sqlString(entity.description),
        sqlString(entity.summaryHtml),
        sqlString(entity.briefest),
        sqlString(entity.brief),
        sqlString(entity.shortDescription),
        sqlString(entity.articleHtml),
        sqlString(entity.rawHeader),
        sqlString(entity.rawJson),
        sqlString(
          entity.category === "other" ? SOURCES.tipnr.source : "TIPNR_JSON"
        )
      ].join(", ")});`
    );

    for (const name of entity.names) {
      statements.push(
        `INSERT INTO EntityNames (entityId, significance, uniqueName, dStrong, eStrong, original, displayName, stepBibleLink, refsText, rawJson) VALUES (${[
          entityId,
          sqlString(name.significance),
          sqlString(name.uniqueName),
          sqlString(name.dStrong),
          sqlString(name.eStrong),
          sqlString(name.original),
          sqlString(name.displayName),
          sqlString(name.stepBibleLink),
          sqlString(name.refsText),
          sqlString(name.rawJson)
        ].join(", ")});`
      );
    }

    for (const ref of entity.refs) {
      statements.push(
        `INSERT OR IGNORE INTO EntityRefs (entityId, book, chapter, verse, suffix, refText) VALUES (${[
          entityId,
          sqlString(ref.book),
          ref.chapter.toString(),
          ref.verse.toString(),
          sqlString(ref.suffix),
          sqlString(ref.refText)
        ].join(", ")});`
      );
    }

    if (entity.category === "place") {
      statements.push(
        `INSERT INTO EntityPlaces (entityId, openBibleName, googleMapUrl, palopenmapsUrl, latitude, longitude, area) VALUES (${[
          entityId,
          sqlString(entity.openBibleName),
          sqlString(entity.googleMapUrl),
          sqlString(entity.palopenmapsUrl),
          sqlNumberOrNull(entity.latitude),
          sqlNumberOrNull(entity.longitude),
          sqlString(entity.area)
        ].join(", ")});`
      );
    }
  }

  for (const entity of input.entities) {
    const entityId = `(SELECT id FROM Entities WHERE uniqueName = ${sqlString(
      entity.uniqueName
    )})`;
    for (const relation of entity.relations) {
      statements.push(
        `INSERT INTO EntityRelations (fromEntityId, relation, toUniqueName, toEntityId, certainty) VALUES (${[
          entityId,
          sqlString(relation.relation),
          sqlString(relation.toUniqueName),
          `(SELECT id FROM Entities WHERE uniqueName = ${sqlString(
            relation.toUniqueName
          )})`,
          sqlString(relation.certainty)
        ].join(", ")});`
      );
    }
  }

  statements.push("COMMIT;");
  statements.push("VACUUM;");

  return `${statements.join("\n")}\n`;
}

function insertMeta(key: string, value: string): string {
  return `INSERT INTO EntityMeta (key, value) VALUES (${sqlString(
    key
  )}, ${sqlString(value)});`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumberOrNull(value: string): string {
  return value ? value : "NULL";
}

function cleanCell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanDash(value: string): string {
  const cleaned = cleanCell(value);
  return cleaned === "-" ? "" : cleaned;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
