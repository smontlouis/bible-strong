#!/usr/bin/env node

import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { defaultSourcesRoot } from "./export-sources.mjs";

const execFileAsync = promisify(execFile);
const outputRoot = path.resolve(defaultSourcesRoot, "..");
const regenerationRoot = path.join(outputRoot, "regeneration");
const correctedRoot = path.join(regenerationRoot, "corrected");
const repositoryRoot = path.resolve(outputRoot, "../../../..");
const bundledEventsPath = path.join(
  repositoryRoot,
  "apps/expo/src/assets/timeline/events.txt"
);

// A French list is filed under the first letter of the title the reader sees.
export const titleLetter = (title) =>
  title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("œ", "o")
    .replaceAll("æ", "a")
    .match(/[\p{L}\p{N}]/u)?.[0] ?? "";

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

export const naveTitlesSql = (titles) =>
  [
    "BEGIN;",
    ...Object.entries(titles).map(
      ([topic, title]) =>
        `UPDATE TOPICS SET name = ${quote(title)}, letter = ${quote(titleLetter(title))} WHERE name_lower = ${quote(topic)};`
    ),
    "DROP TABLE IF EXISTS RESOURCE_METADATA;",
    "COMMIT;"
  ].join("\n");

export const applyEventTitles = (events, titles) =>
  events.map((event) =>
    titles[event.slug] ? { ...event, title: titles[event.slug] } : event
  );

export const applySectionTitles = (sections, titles) =>
  sections.map((section) => ({
    ...section,
    events: section.events.map((event) =>
      titles[event.slug] ? { ...event, title: titles[event.slug] } : event
    )
  }));

const main = async () => {
  const { nave, timeline } = JSON.parse(
    await readFile(path.join(outputRoot, "french-titles.json"), "utf8")
  );
  await mkdir(correctedRoot, { recursive: true });

  const naveSource = path.join(regenerationRoot, "nave-fr.sqlite");
  const naveCorrected = path.join(correctedRoot, "nave-fr.sqlite");
  await copyFile(naveSource, naveCorrected);
  const child = execFile("sqlite3", [naveCorrected]);
  child.stdin.end(naveTitlesSql(nave));
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`sqlite3-exit-${code}`))
    );
  });
  await execFileAsync("sqlite3", [naveCorrected, "VACUUM;"]);

  const events = JSON.parse(
    await readFile(path.join(regenerationRoot, "bible-timeline-events.json"), "utf8")
  );
  await writeFile(
    path.join(correctedRoot, "bible-timeline-events.json"),
    JSON.stringify(applyEventTitles(events, timeline))
  );

  const sections = JSON.parse(await readFile(bundledEventsPath, "utf8"));
  await writeFile(
    bundledEventsPath,
    `${JSON.stringify(applySectionTitles(sections, timeline), null, 2)}\n`
  );
  console.log(
    JSON.stringify({ nave: Object.keys(nave).length, timeline: Object.keys(timeline).length })
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
