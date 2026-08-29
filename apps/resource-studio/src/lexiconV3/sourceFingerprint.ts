import { createHash } from "node:crypto";
import { type DatabaseSync } from "node:sqlite";

/**
 * Fingerprint the source columns that a v3 projection preserves verbatim.
 * English/French display fields are deliberately excluded because projection
 * replaces them; original-language identity and resource tables are included.
 */
export function lexiconV3SourceLogicalFingerprint(db: DatabaseSync): string {
  const schema = db
    .prepare(
      `SELECT type, name, tbl_name AS tableName, sql
       FROM sqlite_schema
       WHERE name NOT LIKE 'sqlite_%'
       ORDER BY type, name`
    )
    .all();
  const stepEntries = db
    .prepare(
      `SELECT id, language, baseCode, eStrong, dStrong, uStrong, original,
              transliteration, morph, classicTransliteration, pronunciation
       FROM StepEntries ORDER BY id`
    )
    .all();
  const resources = tableExists(db, "LexiconResources")
    ? db.prepare("SELECT * FROM LexiconResources ORDER BY id").all()
    : [];
  const resourceTranslations = tableExists(db, "LexiconResourceTranslations")
    ? db
        .prepare(
          `SELECT * FROM LexiconResourceTranslations
           ORDER BY resourceId, language`
        )
        .all()
    : [];
  const morphologyCodes = tableExists(db, "MorphologyCodes")
    ? db.prepare("SELECT * FROM MorphologyCodes ORDER BY id").all()
    : [];
  const morphologyTranslations = tableExists(db, "MorphologyCodeTranslations")
    ? db
        .prepare(
          `SELECT * FROM MorphologyCodeTranslations
           ORDER BY morphologyCodeId, language`
        )
        .all()
    : [];
  const dictionaryMeta = tableExists(db, "DictionaryMeta")
    ? db.prepare("SELECT * FROM DictionaryMeta ORDER BY key").all()
    : [];
  return createHash("sha256")
    .update(
      canonicalJson({
        dictionaryMeta,
        morphologyCodes,
        morphologyTranslations,
        resourceTranslations,
        resources,
        schema,
        stepEntries
      })
    )
    .digest("hex");
}

function tableExists(db: DatabaseSync, name: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name)
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
