import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const clampInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
};

export const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

export const escapeSqlLike = (value) =>
  String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");

const querySqlite = async (databasePath, sql) => {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-json", databasePath, sql],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    }
  );
  return JSON.parse(stdout || "[]");
};

const isReadable = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const createDictionaryReaderStore = async (
  configPath,
  { normalizedRoot } = {}
) => {
  const resolvedConfigPath = path.resolve(configPath);
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  const configDirectory = path.dirname(resolvedConfigPath);
  const publications = await Promise.all(
    config.publications.map(async (publication) => {
      const sourceSqlitePath = path.resolve(
        configDirectory,
        publication.sqlitePath
      );
      const normalizedSqlitePath = normalizedRoot
        ? path.resolve(normalizedRoot, `${publication.work}.sqlite`)
        : null;
      const normalized = normalizedSqlitePath
        ? await isReadable(normalizedSqlitePath)
        : false;
      const sqlitePath = normalized ? normalizedSqlitePath : sourceSqlitePath;
      return {
        ...publication,
        sqlitePath,
        normalized,
        available: await isReadable(sqlitePath)
      };
    })
  );
  const byWork = new Map(
    publications.map((publication) => [publication.work, publication])
  );

  const requirePublication = (work) => {
    const publication = byWork.get(work);
    if (!publication) throw new Error(`Dictionnaire inconnu : ${work}`);
    if (!publication.available) throw new Error(`SQLite absent pour ${work}`);
    return publication;
  };

  return {
    async catalog() {
      return Promise.all(
        publications.map(async (publication) => {
          const counts = publication.available
            ? await querySqlite(
                publication.sqlitePath,
                `SELECT (SELECT count(*) FROM dictionnaire) AS entries,
                        (SELECT count(*) FROM verses) AS verseAnchors`
              )
            : [];
          return {
            work: publication.work,
            resourceId: publication.resourceId,
            language: publication.language,
            title: publication.title,
            abbreviation: publication.abbreviation,
            authors: publication.authors,
            description: publication.description,
            edition: publication.edition,
            source: publication.source,
            sourceVersion: publication.sourceVersion,
            rights: publication.rights,
            deliveryCapabilities: publication.deliveryCapabilities,
            normalized: publication.normalized,
            available: publication.available,
            counts: {
              entries: counts[0]?.entries ?? 0,
              verseAnchors: counts[0]?.verseAnchors ?? 0
            }
          };
        })
      );
    },

    async listEntries({ work, search, initial, offset, limit }) {
      const publication = requirePublication(work);
      const safeLimit = clampInteger(limit, 80, 1, 100);
      const safeOffset = clampInteger(offset, 0, 0, 1_000_000);
      const conditions = [];
      if (search?.trim()) {
        const pattern = `%${escapeSqlLike(search.trim())}%`;
        conditions.push(
          `(word LIKE ${quoteSql(pattern)} ESCAPE '\\' COLLATE NOCASE OR sanitized_word LIKE ${quoteSql(pattern)} ESCAPE '\\' COLLATE NOCASE)`
        );
      } else if (initial?.trim()) {
        const normalizedInitial = initial
          .trim()
          .toLocaleLowerCase(publication.language);
        conditions.push(
          `substr(lower(sanitized_word), 1, 1) = ${quoteSql(normalizedInitial.slice(0, 1))}`
        );
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const countRows = await querySqlite(
        publication.sqlitePath,
        `SELECT count(*) AS count FROM dictionnaire ${where}`
      );
      const entries = await querySqlite(
        publication.sqlitePath,
        `SELECT id, word, sanitized_word AS normalizedWord
         FROM dictionnaire ${where}
         ORDER BY sanitized_word COLLATE NOCASE, id
         LIMIT ${safeLimit} OFFSET ${safeOffset}`
      );
      return {
        work,
        entries,
        total: countRows[0]?.count ?? 0,
        offset: safeOffset,
        limit: safeLimit
      };
    },

    async getEntry({ work, id }) {
      const publication = requirePublication(work);
      const entryId = clampInteger(id, 0, 1, Number.MAX_SAFE_INTEGER);
      const rows = await querySqlite(
        publication.sqlitePath,
        `SELECT id, word, sanitized_word AS normalizedWord, definition
         FROM dictionnaire WHERE id = ${entryId} LIMIT 1`
      );
      return rows[0] ?? null;
    }
  };
};
