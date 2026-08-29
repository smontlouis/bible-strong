import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  runBuildFrenchEditorialAssets,
  type BuildFrenchEditorialAssetsOptions
} from "../scripts/buildLexiconV3FrenchEditorialAssets.js";
import {
  buildFrenchMorphologyContent,
  contentHash,
  FRENCH_BOOK_REGISTRY,
  normalizeFrenchEvidence,
  validateFrenchBookRegistry
} from "../src/lexiconV3/frenchEditorialPolicy.js";

test("exposes an exact 66-book canonical French registry", () => {
  validateFrenchBookRegistry();

  assert.equal(FRENCH_BOOK_REGISTRY.length, 66);
  assert.equal(FRENCH_BOOK_REGISTRY[0]?.bookId, "Gen");
  assert.equal(FRENCH_BOOK_REGISTRY[0]?.canonicalFr, "Genèse");
  assert.equal(FRENCH_BOOK_REGISTRY[21]?.canonicalFr, "Cantique des cantiques");
  assert.equal(FRENCH_BOOK_REGISTRY[65]?.canonicalFr, "Apocalypse");
  assert.equal(
    new Set(FRENCH_BOOK_REGISTRY.map((book) => book.bookId)).size,
    66
  );
});

test("reconstructs lexical and tagged morphology from bounded structured values", () => {
  const lexical = buildFrenchMorphologyContent({
    id: 1,
    code: "N:N-M-P",
    normalizedCode: "N:N-M-P",
    language: "name",
    scope: "lexical_brief",
    example: "",
    meaning: "Proper Name of a Male Person",
    description: "",
    source: "TEHMC"
  });
  assert.equal(lexical.meaning, "nom propre de personne masculine");
  assert.doesNotMatch(lexical.description, /\b(?:Male|Person|Proper)\b/u);

  const tagged = buildFrenchMorphologyContent({
    id: 2,
    code: "V-PAI-3S",
    normalizedCode: "V-PAI-3S",
    language: "greek",
    scope: "tagged_full",
    example: "he speaks",
    meaning: "Verb Present Active Indicative Third Singular",
    description:
      "Function=Verb; Voice=Active; Tense=Present; Mood=Indicative; Person=3rd; Number=Singular an ACTION",
    source: "TEGMC"
  });
  assert.equal(
    tagged.description,
    "Fonction : verbe; Voix : active; Temps : présent; Mode : indicatif; Personne : 3e personne; Nombre : singulier."
  );
  assert.match(tagged.example, /V-PAI-3S/u);

  assert.throws(
    () =>
      buildFrenchMorphologyContent({
        id: 3,
        code: "UNKNOWN",
        normalizedCode: "UNKNOWN",
        language: "greek",
        scope: "tagged_full",
        example: "",
        meaning: "",
        description: "Function=Unbounded invented category",
        source: "TEGMC"
      }),
    /unsupported-morphology-value/u
  );
});

test("builds hashed book, entity, termbase, morphology, summary and report artifacts", async () => {
  const fixture = await createFixture();
  const summary = await runBuildFrenchEditorialAssets(fixture.options);

  assert.equal(summary.counts.books, 66);
  assert.equal(summary.counts.entries, 3);
  assert.equal(summary.counts.entityRegistry, 2);
  assert.deepEqual(summary.counts.entityStatus, {
    green: 1,
    yellow: 0,
    red: 1
  });
  assert.deepEqual(summary.counts.termbaseStatus, {
    green: 1,
    yellow: 1,
    red: 1
  });
  assert.equal(summary.counts.morphologyTranslations, 2);
  assert.equal(summary.counts.historicalFrenchCandidates, 3);
  assert.equal(summary.summaryContentHash.length, 64);

  const bookRegistry = JSON.parse(
    await readFile(
      path.join(fixture.options.outputDir, "book-registry.json"),
      "utf8"
    )
  ) as { books: unknown[]; contentHash: string };
  assert.equal(bookRegistry.books.length, 66);
  assert.equal(bookRegistry.contentHash.length, 64);

  const entities = await readJsonl<{
    entryKey: string;
    status: string;
    canonicalFr: string | null;
    reasons: string[];
    historicalCandidate: { trust: string } | null;
    contentHash: string;
  }>(path.join(fixture.options.outputDir, "entity-registry.jsonl"));
  const aaron = entities.find((row) => row.entryKey === "greek:G0002");
  const adasai = entities.find((row) => row.entryKey === "greek:G21425");
  assert.equal(aaron?.status, "green");
  assert.equal(aaron?.canonicalFr, "Aaron");
  assert.equal(aaron?.historicalCandidate?.trust, "untrusted-candidate");
  assert.equal(adasai?.status, "red");
  assert.ok(
    adasai?.reasons.includes("reconstructed-lxx-name-without-tipnr-entity")
  );
  assert.ok(entities.every((row) => /^[a-f0-9]{64}$/u.test(row.contentHash)));

  const termbase = await readJsonl<{
    entryKey: string;
    status: string;
    canonicalFr: string | null;
    historicalFrench: { trust: string } | null;
    legacyFrench: { evidenceScope: string } | null;
    concordanceForms: Array<{ evidenceScope: string }>;
    deterministicRepairCandidate: { gloss: string; trust: string } | null;
  }>(path.join(fixture.options.outputDir, "termbase-candidates.jsonl"));
  const love = termbase.find((row) => row.entryKey === "greek:G0025");
  assert.equal(love?.status, "yellow");
  assert.equal(love?.canonicalFr, null);
  assert.equal(love?.historicalFrench?.trust, "untrusted-candidate");
  assert.equal(love?.legacyFrench?.evidenceScope, "classical-strong-only");
  assert.equal(love?.deterministicRepairCandidate?.gloss, "aimer");
  assert.equal(
    love?.deterministicRepairCandidate?.trust,
    "untrusted-candidate"
  );
  assert.ok(
    love?.concordanceForms.every(
      (form) => form.evidenceScope === "classical-strong-only"
    )
  );

  const morphology = await readJsonl<{
    meaning: string;
    contentHash: string;
  }>(path.join(fixture.options.outputDir, "morphology-translations.jsonl"));
  assert.equal(morphology.length, 2);
  assert.ok(morphology.every((row) => row.meaning.length > 0));
  assert.ok(morphology.every((row) => row.contentHash.length === 64));

  for (const artifact of Object.values(summary.artifacts)) {
    const body = await readFile(artifact.path);
    assert.equal(
      createHash("sha256").update(body).digest("hex"),
      artifact.sha256
    );
    assert.equal(body.byteLength, artifact.bytes);
  }

  const report = await readFile(fixture.options.report, "utf8");
  assert.match(report, /Entités green \| 1/u);
  assert.match(report, /candidats non fiables/u);
  const writtenSummary = JSON.parse(
    await readFile(path.join(fixture.options.outputDir, "summary.json"), "utf8")
  ) as { summaryContentHash: string };
  assert.equal(writtenSummary.summaryContentHash, summary.summaryContentHash);
});

test("fails closed before writing when current English field lineage is incomplete", async () => {
  const fixture = await createFixture();
  const db = new DatabaseSync(fixture.options.coreDatabase);
  db.exec(
    "delete from LexiconFieldStatus where stepEntryId=2 and field='meaning'"
  );
  db.close();

  await assert.rejects(
    runBuildFrenchEditorialAssets(fixture.options),
    /incomplete-english-field-status/u
  );
  await assert.rejects(
    access(path.join(fixture.options.outputDir, "summary.json"))
  );
});

test("normalizes French evidence without turning it into authority", () => {
  assert.equal(normalizeFrenchEvidence("  L’Éternel  "), "l eternel");
  assert.equal(contentHash({ trust: "untrusted-candidate" }).length, 64);
});

async function createFixture(): Promise<{
  root: string;
  options: BuildFrenchEditorialAssetsOptions;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "lexicon-v3-fr-editorial-"));
  const core = path.join(root, "core.sqlite");
  const historical = path.join(root, "historical.sqlite");
  const legacy = path.join(root, "legacy.sqlite");
  const entities = path.join(root, "entities.sqlite");
  const sg1910 = path.join(root, "Sg1910.csv");
  const darby = path.join(root, "Darby.csv");
  const darbyR = path.join(root, "DarbyR.csv");
  const guide = path.join(root, "guide.json");
  const outputDir = path.join(root, "output");
  const report = path.join(root, "report.md");

  createCore(core);
  createHistorical(historical);
  createLegacy(legacy);
  createEntities(entities);
  const csv =
    [
      "book_id\tnum_chapter\tnum_verse\ttext",
      'Gen\t1\t1\t<w strong="G0002">Aaron</w> <w strong="G0025">aimer</w>'
    ].join("\n") + "\n";
  await Promise.all([
    writeFile(sg1910, csv),
    writeFile(darby, csv),
    writeFile(darbyR, csv),
    writeFile(
      guide,
      JSON.stringify({
        schemaVersion: "lexicon-v3-french-editorial-guide@1",
        locale: "fr",
        releaseRule: "Toute divergence bloque la release."
      })
    )
  ]);

  return {
    root,
    options: {
      coreDatabase: core,
      historicalDatabase: historical,
      legacyDatabase: legacy,
      entitiesDatabase: entities,
      sg1910,
      darby,
      darbyR,
      editorialGuide: guide,
      outputDir,
      report,
      expectedEntryCount: 3,
      expectedProperEntryCount: 2,
      expectedMorphologyCount: 2,
      generatedAt: "2026-07-13T12:00:00.000Z"
    }
  };
}

function createCore(file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`
    create table StepEntries (
      id integer primary key,
      language text not null,
      baseCode integer not null,
      eStrong text not null,
      dStrong text not null,
      uStrong text not null,
      original text not null,
      transliteration text not null,
      morph text not null,
      gloss text not null,
      meaning text not null
    );
    insert into StepEntries values
      (1,'greek',2,'G0002','G0002 = the Greek of','H0175','Ἀαρών','Aarōn','N:N-M-P','Aaron','<p>Aaron.</p>'),
      (2,'greek',25,'G0025','G0025 =','G0025','ἀγαπάω','agapaō','G:V','to love','<p>To love.</p>'),
      (3,'greek',21425,'G21425','G21425 =','G21425','Αδασαι','','G:N-PRI','Adasai','<p>A LXX name.</p>');
    create table LexiconFieldStatus (
      stepEntryId integer not null,
      locale text not null,
      field text not null,
      state text not null,
      confidence real not null,
      method text not null,
      contentHash text not null,
      releaseKey text not null
    );
    insert into LexiconFieldStatus values
      (1,'en','gloss','auto_validated',0.98,'fixture','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','fixture-release'),
      (1,'en','meaning','auto_validated',0.98,'fixture','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','fixture-release'),
      (2,'en','gloss','auto_validated',0.98,'fixture','cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','fixture-release'),
      (2,'en','meaning','auto_validated',0.98,'fixture','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','fixture-release'),
      (3,'en','gloss','auto_validated',0.98,'fixture','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','fixture-release'),
      (3,'en','meaning','auto_validated',0.98,'fixture','ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','fixture-release');
    create table MorphologyCodes (
      id integer primary key,
      code text not null,
      normalizedCode text not null,
      language text not null,
      scope text not null,
      example text not null,
      meaning text not null,
      description text not null,
      source text not null
    );
    insert into MorphologyCodes values
      (1,'G:V','G:V','greek','lexical_brief','','Greek Verb','','TEGMC'),
      (2,'V-PAI-3S','V-PAI-3S','greek','tagged_full','he speaks','Verb Present Active Indicative Third Singular','Function=Verb; Voice=Active; Tense=Present; Mood=Indicative; Person=3rd; Number=Singular an ACTION','TEGMC');
    create table DictionaryMeta (key text primary key, value text not null);
    insert into DictionaryMeta values ('lexiconV3ReleaseKey','fixture-release');
  `);
  db.close();
}

function createHistorical(file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`
    create table StepEntries (
      id integer primary key,
      language text not null,
      dStrong text not null
    );
    insert into StepEntries values
      (1,'greek','G0002 = the Greek of'),
      (2,'greek','G0025 ='),
      (3,'greek','G21425 =');
    create table LexiconTranslations (
      stepEntryId integer not null,
      language text not null,
      gloss text not null,
      meaning text not null,
      meaningHtml text not null
    );
    insert into LexiconTranslations values
      (1,'fr','Aaron','Aaron.','<p>Aaron.</p>'),
      (2,'fr','pour aimer','Aimer.','<p>Aimer.</p>'),
      (3,'fr','Adasai','Nom de la LXX.','<p>Nom de la LXX.</p>');
  `);
  db.close();
}

function createLegacy(file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`
    create table Grec (
      Code integer primary key,
      Mot text not null,
      Type text not null,
      LSG text not null,
      Definition text not null
    );
    insert into Grec values
      (2,'Aaron','nom propre','Aaron','Aaron.'),
      (25,'agapao','verbe','aimer','aimer, chérir');
    create table Hebreu (
      Code integer primary key,
      Mot text not null,
      Type text not null,
      LSG text not null,
      Definition text not null
    );
  `);
  db.close();
}

function createEntities(file: string): void {
  const db = new DatabaseSync(file);
  db.exec(`
    create table Entities (
      id integer primary key,
      displayName text not null,
      category text not null,
      type text not null
    );
    insert into Entities values (1,'Aaron','person','Male');
    create table EntityNames (
      dStrong text not null,
      entityId integer not null,
      significance text not null,
      displayName text not null
    );
    insert into EntityNames values ('G0002',1,'Greek','Aaron');
    create table EntityTranslations (
      entityId integer not null,
      language text not null,
      displayName text not null
    );
    insert into EntityTranslations values (1,'fr','Aaron');
  `);
  db.close();
}

async function readJsonl<T>(file: string): Promise<T[]> {
  return (await readFile(file, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
