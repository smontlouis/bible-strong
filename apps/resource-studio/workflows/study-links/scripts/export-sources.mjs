#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
export const defaultSourcesRoot = path.resolve(
  workflowRoot,
  "../../outputs/study-links/sources"
);

const active = (identity) =>
  `(select id from resource_publications where status = 'active' and resource_identity = '${identity}')`;

const dictionaryWorks = {
  "dictionary:bost:fr": ["bost", "fr"],
  "dictionary:calmet:fr": ["calmet", "fr"],
  "dictionary:lelievre:fr": ["lelievre", "fr"],
  "dictionary:westphal:fr": ["westphal", "fr"],
  "dictionary:easton-webster:en": ["easton-webster", "en"],
  "dictionary:isbe:en": ["isbe", "en"],
  "dictionary:smith:en": ["smith", "en"],
  "dictionary:unfoldingword-translation-words:en": [
    "unfoldingword-translation-words",
    "en"
  ]
};

const dictionaryWorkCase = Object.entries(dictionaryWorks)
  .map(
    ([identity, [work, language]]) =>
      `when ${active(identity)} then '${work}|${language}'`
  )
  .join(" ");
const dictionaryIds = Object.keys(dictionaryWorks).map(active).join(", ");

const spansQuery = (indexIdentity, textIdentity) => `
  select s.book, s.chapter, s.verse, s.ordinal,
         substring(v.text from s.start_offset + 1 for s.length) as surface,
         coalesce(string_agg(i.kind || ':' || i.code, ' ' order by si.identity_order), '') as ids
  from strong_bible_spans s
  join bible_verses v
    on v.publication_id = ${active(textIdentity)}
   and v.book = s.book and v.chapter = s.chapter and v.verse = s.verse
  left join strong_bible_span_identities si
    on si.publication_id = s.publication_id and si.book = s.book
   and si.chapter = s.chapter and si.verse = s.verse and si.ordinal = s.ordinal
  left join strong_bible_identities i
    on i.publication_id = si.publication_id and i.identity_id = si.identity_id
  where s.publication_id = ${active(indexIdentity)}
  group by s.book, s.chapter, s.verse, s.ordinal, v.text, s.start_offset, s.length`;

const entitiesPublication = active("strong-lexicon:entities");

export const sourceQueries = {
  entities: `
    select e.entity_id, e.unique_name, e.u_strong,
           e.payload->>'category' as category, e.payload->>'type' as type,
           e.payload->>'displayName' as name_en, t.payload->>'displayName' as name_fr,
           e.payload->>'brief' as brief_en, t.payload->>'brief' as brief_fr
    from strong_lexicon_entities e
    join strong_lexicon_entity_translations t
      on t.publication_id = e.publication_id and t.entity_id = e.entity_id and t.language = 'fr'
    where e.publication_id = ${entitiesPublication}`,
  "entity-refs": `
    select entity_id, book, chapter, verse
    from strong_lexicon_entity_refs where publication_id = ${entitiesPublication}`,
  nave: `
    select a.normalized_name, a.name as name_en, b.name as name_fr,
           a.description as description_en, b.description as description_fr
    from nave_topics a
    join nave_topics b on a.normalized_name = b.normalized_name
    where a.publication_id = ${active("nave:en")} and b.publication_id = ${active("nave:fr")}`,
  "nave-links": `
    select verse_key, normalized_name
    from nave_verse_links where publication_id = ${active("nave:fr")}`,
  timeline: `
    select a.event_id, a.slug, a.title as title_en, b.title as title_fr, a.dates, a.period,
           a.description as description_en, b.description as description_fr,
           a.scriptures::text as scriptures, a.related::text as related
    from timeline_events a
    join timeline_events b on a.event_id = b.event_id
    where a.publication_id = ${active("timeline:en")} and b.publication_id = ${active("timeline:fr")}`,
  dictionary: `
    select case publication_id ${dictionaryWorkCase} end as work_language,
           entry_id, word, normalized_word, correspondence_id, left(definition, 1800) as excerpt
    from dictionary_entries where publication_id in (${dictionaryIds})`,
  "dictionary-citations": `
    select case publication_id ${dictionaryWorkCase} end as work_language, entry_id, verse_key
    from dictionary_verse_links
    where publication_id in (${dictionaryIds}) and entry_id is not null`,
  "dictionary-presences": `
    select work, entry_id, verse_key, evidence_kind
    from dictionary_directory_verse_presences
    where publication_id = ${active("dictionary-directory")}`,
  "spans-kjv": spansQuery("strong-bible-index:KJV", "bible-text:KJV"),
  "spans-lsg": spansQuery("strong-bible-index:LSG", "bible-text:LSG")
};

const runPsql = (script) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "psql",
      [process.env.RESOURCE_DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1"],
      {
        env: {
          ...process.env,
          PGOPTIONS: "-c default_transaction_read_only=on",
          PGSSLROOTCERT: process.env.PGSSLROOTCERT ?? "/etc/ssl/cert.pem"
        },
        stdio: ["pipe", "inherit", "inherit"]
      }
    );
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`psql-exit-${code}`))
    );
    child.stdin.end(script);
  });

const compactSql = (sql) => sql.replace(/\s+/g, " ").trim();

const main = async () => {
  if (!process.env.RESOURCE_DATABASE_URL) {
    throw new Error("study-links-export-database-url-missing");
  }
  const only = process.argv.slice(2);
  await mkdir(defaultSourcesRoot, { recursive: true });
  const names = Object.keys(sourceQueries).filter(
    (name) => only.length === 0 || only.includes(name)
  );
  await runPsql(
    names
      .map(
        (name) =>
          `\\copy (${compactSql(sourceQueries[name])}) to '${path.join(defaultSourcesRoot, `${name}.csv`)}' with (format csv, header true)`
      )
      .join("\n")
  );
  await writeFile(
    path.join(defaultSourcesRoot, "export.json"),
    `${JSON.stringify({ exportedAt: new Date().toISOString(), sources: names }, null, 2)}\n`
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
