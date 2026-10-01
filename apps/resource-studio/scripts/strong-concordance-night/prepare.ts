/** Acquisition/evaluation process only. Produces physically separate masked inputs. */
import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  symlink,
  writeFile
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import { goldVerse, sha, type Plan, type RawVerse } from "./contract.js";

const workspace = process.cwd();
const root = path.resolve(
  process.argv[2] ?? "outputs/strong-concordance-night/final-v2"
);
const plan: Plan = JSON.parse(
  await readFile(path.join(root, "plan.json"), "utf8")
);
const inputs: Record<string, string> = {};
async function save(file: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  await mkdir(path.dirname(file), { recursive: true });
  if (existsSync(file))
    assert.equal(await readFile(file, "utf8"), text, `immutable-drift:${file}`);
  else await writeFile(file, text, { flag: "wx" });
  inputs[path.relative(root, file)] = sha(text);
}
const editions = [...Object.keys(plan.editions), "Sg1910", "Darby", "DarbyR"];
for (const edition of editions) {
  const local = ["Sg1910", "Darby", "DarbyR"].includes(edition);
  const rows = local ? await readStrongCsv(`data/strongs/${edition}.csv`) : [];
  for (const split of ["development", "test"] as const) {
    const chapters = plan.chapters
      .filter((c) => c.split === split)
      .map((c) => c.ref);
    let targets: Array<{ ref: string; text: string }>;
    if (!local) {
      const gold = (
        await Promise.all(
          chapters.map(async (chapter) => {
            const file = path.join(
              root,
              "evaluator-only",
              `${edition}-${chapter}.json`
            );
            const content = await readFile(file, "utf8");
            inputs[path.relative(root, file)] = sha(content);
            const page = JSON.parse(content) as { verses: RawVerse[] };
            return page.verses.map((raw) => goldVerse(chapter, raw));
          })
        )
      ).flat();
      await save(
        path.join(root, "evaluator-only", `${edition}-${split}.gold.json`),
        gold
      );
      targets = gold.map(({ ref, text }) => ({ ref, text }));
    } else {
      targets = rows
        .filter((r) => chapters.includes(`${r.bookId}.${r.chapter}`))
        .map((r) => ({
          ref: `${r.bookId}.${r.chapter}.${r.verse}`,
          text: stripTags(withoutPublisherNotes(r.text))
            .replace(/◎/gu, "")
            .replace(/\s+/gu, " ")
            .trim()
        }));
    }
    assert(targets.length > 0);
    await save(path.join(root, "masked", `${edition}-${split}.json`), targets);
    const bible: Record<string, Record<string, Record<string, string>>> = {};
    for (const row of targets) {
      assert.deepEqual(Object.keys(row).sort(), ["ref", "text"]);
      assert(!/data-|<w\b|◎/u.test(row.text));
      const [book, chapter, verse] = row.ref.split(".");
      const number = BOOK_IDS.indexOf(book as never) + 1;
      assert(number > 0);
      ((bible[number] ??= {})[chapter] ??= {})[verse] = row.text;
    }
    await save(
      path.join(root, "masked", `${edition}-${split}.bible.json`),
      bible
    );
  }
}

// An allowlist of bytes. No data/derived, corrections, model output or target
// annotations is copied or linked into any predictor working directory.
for (const [scenario, names] of Object.entries({
  ...plan.scenarios,
  "control-segond": ["Darby", "DarbyR"],
  "control-darby": ["Sg1910"]
})) {
  const env = path.join(root, "environments", scenario);
  await mkdir(env, { recursive: true });
  for (const folder of ["src", "scripts"]) {
    const link = path.join(env, folder);
    if (!existsSync(link))
      await symlink(
        path.join(root, "initial-code/apps/resource-studio", folder),
        link
      );
  }
  const selected = [
    ...names.map((name) => `data/strongs/${name}.csv`),
    ...(await readdir("data/external/stepbible/amalgamated"))
      .filter((f) => /^(TAGNT|TAHOT).*\.txt$/u.test(f))
      .map((f) => `data/external/stepbible/amalgamated/${f}`)
  ];
  for (const file of selected) {
    const target = path.join(env, file);
    await mkdir(path.dirname(target), { recursive: true });
    if (!existsSync(target)) await copyFile(file, target);
    const hash = sha(await readFile(file));
    assert.equal(sha(await readFile(target)), hash);
    inputs[path.relative(root, target)] = hash;
  }
  const dictionary = path.join(env, "empty-dictionary.sqlite");
  if (!existsSync(dictionary)) {
    const db = new DatabaseSync(dictionary);
    // Baseline sqlite CLI returns an empty string for zero rows. One punctuation
    // sentinel with no valid identity makes its legacy reader return exactly []
    // without changing baseline code or weakening any V3 attestation.
    db.exec(`CREATE TABLE StepEntries(id INTEGER, eStrong TEXT, dStrong TEXT, uStrong TEXT, morph TEXT);
      CREATE TABLE LexiconTranslations(stepEntryId INTEGER, language TEXT, gloss TEXT, meaning TEXT);
      INSERT INTO StepEntries VALUES(1,'','','','');
      INSERT INTO LexiconTranslations VALUES(1,'fr','.','.');`);
    db.close();
  }
  inputs[path.relative(root, dictionary)] = sha(await readFile(dictionary));
  await save(path.join(env, "allowed-inputs.json"), {
    scenario,
    references: names,
    dictionaryCandidates: 0,
    files: selected,
    remoteModels: false
  });
}
await save(path.join(root, "prepared-inputs.json"), {
  planSha256: sha(await readFile(path.join(root, "plan.json"))),
  files: inputs,
  workspace
});
console.log(
  "Prepared separate masked inputs, evaluator gold, and four allowlisted environments."
);
