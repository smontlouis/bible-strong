import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PRODUCTION_STRONG_DICTIONARY,
  readStrongDictionaryTranslationCandidates,
  resolveDefaultStrongDictionaryInput
} from "../src/strongDictionaryLexicon.js";
import {
  buildStrongTranslationLexicon,
  findTranslationCandidate
} from "../src/translationLexicon.js";

test("binds the legacy fallback explicitly when no V3 activation pointer exists", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "strong-pointer-test-"));
  const input = resolveDefaultStrongDictionaryInput(
    path.join(directory, "missing-current.json")
  );
  assert.deepEqual(input, {
    path: DEFAULT_PRODUCTION_STRONG_DICTIONARY,
    activation: {
      mode: "legacy",
      path: DEFAULT_PRODUCTION_STRONG_DICTIONARY
    }
  });
});

test("keeps legacy French dictionary candidates review-only", async () => {
  const dbPath = await writeTempLexiconDb();

  const candidates = readStrongDictionaryTranslationCandidates(dbPath);

  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "H0120" &&
        candidate.normalized === "humain" &&
        candidate.method === "dictionary-fr-exact" &&
        candidate.score >= 0.5 &&
        candidate.reviewOnly === true
    )
  );
  assert.equal(
    candidates.find(
      (candidate) =>
        candidate.strong === "H0120" && candidate.normalized === "personne"
    )?.reviewOnly,
    true
  );
  assert.equal(
    candidates.find(
      (candidate) =>
        candidate.strong === "G0014" && candidate.normalized === "bien"
    )?.reviewOnly,
    true
  );
  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "G0014" &&
        candidate.normalized === "bien" &&
        candidate.source === "strong-lexicon-sqlite:fr-gloss-token"
    )
  );

  const productionLexicon = buildStrongTranslationLexicon([], {
    dictionaryCandidates: candidates
  });
  assert.equal(
    findTranslationCandidate(productionLexicon, "H0120", "humain"),
    undefined
  );
  assert.equal(
    findTranslationCandidate(productionLexicon, "H0120", "personne"),
    undefined
  );
  assert.equal(
    findTranslationCandidate(productionLexicon, "H6213", "faire"),
    undefined
  );
  assert.equal(
    candidates.some((candidate) => candidate.normalized === "le"),
    false
  );
  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "H3226" &&
        candidate.normalized === "jamin" &&
        candidate.source === "strong-lexicon-sqlite:fr-gloss"
    )
  );
  assert.equal(
    candidates.some(
      (candidate) =>
        candidate.strong === "H3226" && candidate.normalized === "simeon"
    ),
    false
  );
  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "G2424" &&
        candidate.normalized === "jesus" &&
        candidate.source === "strong-lexicon-sqlite:fr-gloss"
    )
  );
  assert.equal(
    candidates.some(
      (candidate) =>
        candidate.strong === "G2424" && candidate.normalized === "disciples"
    ),
    false
  );
  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "G5546" && candidate.normalized === "chretien"
    )
  );
  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "G4771" && candidate.normalized === "toi-meme"
    )
  );
  assert.equal(
    findTranslationCandidate(productionLexicon, "H0001", "pere", "H0001A"),
    undefined
  );
  assert.equal(
    findTranslationCandidate(productionLexicon, "H0001", "chef", "H0001A"),
    undefined
  );
  assert.equal(
    findTranslationCandidate(productionLexicon, "H0001", "chef", "H0001B"),
    undefined
  );
});

test("v3 carrier terms isolate alignment evidence from display translations", async () => {
  const dbPath = await writeTempLexiconDb();
  execFileSync("sqlite3", [
    dbPath,
    `
      create table LexiconCarrierTerms (
        id integer primary key,
        stepEntryId integer not null,
        strong text not null,
        stepStrong text,
        locale text not null,
        surface text not null,
        normalized text not null,
        termKind text not null,
        state text not null,
        policy text not null,
        confidence real not null,
        derivedFromVersionId integer,
        contentHash text not null,
        releaseKey text not null
      );
      create table LexiconFieldStatus (
        stepEntryId integer not null,
        locale text not null,
        field text not null,
        fieldVersionId integer not null,
        releaseKey text not null
      );
      create table DictionaryMeta (key text primary key, value text not null);
      insert into DictionaryMeta values
        ('lexiconV3ReleaseKey', 'release-fixture'),
        ('lexiconV3Profile', 'full'),
        ('lexiconV3SourceFingerprint', '${"a".repeat(64)}'),
        ('lexiconV3CodeFingerprint', '${"b".repeat(64)}'),
        ('lexiconV3SnapshotFingerprint', '${"c".repeat(64)}'),
        ('lexiconV3PolicyVersion', 'policy-fixture');
      insert into LexiconFieldStatus values
        (1, 'fr', 'gloss', 10, 'release-fixture'),
        (2, 'fr', 'gloss', 11, 'release-fixture'),
        (8, 'fr', 'gloss', 12, 'release-fixture'),
        (5, 'fr', 'gloss', 13, 'release-fixture');
      insert into LexiconCarrierTerms
        (id, stepEntryId, strong, stepStrong, locale, surface, normalized,
         termKind, state, policy, confidence, derivedFromVersionId, contentHash,
         releaseKey)
      values
        (1, 1, 'H0120', 'H0120', 'fr', 'humain', 'humain',
         'headword', 'auto_validated', 'auto_safe', 0.93, 10, 'hash-1', 'release-fixture'),
        (2, 2, 'G0014', 'G0014', 'fr', 'bien', 'bien',
         'headword', 'human_validated', 'review_only', 0.88, 11, 'hash-2', 'release-fixture'),
        (3, 8, 'H6213', 'H6213', 'fr', 'faire', 'faire',
         'headword', 'candidate', 'auto_safe', 0.99, 12, 'hash-3', 'release-fixture'),
        (4, 5, 'G2424', 'G2424G', 'fr', 'Jésus', 'jesus',
         'headword', 'human_validated', 'blocked', 1.0, 13, 'hash-4', 'release-fixture');
      update LexiconTranslations
      set gloss = 'contamination', meaning = 'contamination définitionnelle';
    `
  ]);

  const candidates = readStrongDictionaryTranslationCandidates(dbPath, {
    strict: true
  });

  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "H0120" &&
        candidate.normalized === "humain" &&
        candidate.reviewOnly !== true
    )
  );
  assert.equal(
    candidates.find(
      (candidate) =>
        candidate.strong === "G0014" && candidate.normalized === "bien"
    )?.reviewOnly,
    true
  );
  assert.equal(
    candidates.some((candidate) => candidate.normalized === "contamination"),
    false
  );
  assert.equal(
    candidates.some(
      (candidate) =>
        candidate.strong === "H6213" && candidate.normalized === "faire"
    ),
    false
  );
  assert.equal(
    candidates.some(
      (candidate) =>
        candidate.strong === "G2424" && candidate.normalized === "jesus"
    ),
    false
  );
});

test("refuses authoring carrier tables that are not a promoted projection", async () => {
  const dbPath = await writeTempLexiconDb();
  execFileSync("sqlite3", [
    dbPath,
    `create table LexiconCarrierTerms (
       id integer primary key,
       strong text not null,
       stepStrong text,
       locale text not null,
       normalized text not null,
       state text not null,
       policy text not null,
       confidence real not null
     );`
  ]);

  assert.throws(
    () =>
      readStrongDictionaryTranslationCandidates(dbPath, {
        strict: true
      }),
    /unattested-v3-carrier-database/u
  );
});

async function writeTempLexiconDb(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "strong-lexicon-test-"));
  const dbPath = path.join(dir, "strong_lexicon.full.production.sqlite");
  execFileSync("sqlite3", [
    dbPath,
    `
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
        meaning text not null,
        classicTransliteration text not null default '',
        pronunciation text not null default ''
      );
      create table LexiconTranslations (
        stepEntryId integer not null,
        language text not null,
        gloss text not null,
        meaning text not null,
        meaningHtml text not null
      );
      insert into StepEntries
        (id, language, baseCode, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning)
      values
        (1, 'Hebrew', 120, 'H0120', 'H0120 =', 'H0120', 'אָדָם', 'adam', 'N', 'human', 'human'),
        (2, 'Greek', 14, 'G0014', 'G0014 =', 'G0014', 'ἀγαθοεργέω', 'agathoergeo', 'V', 'do good', 'do good'),
        (3, 'Hebrew', 3226, 'H3226', 'H3226G =', 'H3226G', 'יָמִין', 'jamin', 'N:N-M-P', 'Jamin', 'Jamin = fils de Siméon, fondateur des Jaminites'),
        (4, 'Hebrew', 3228, 'H3228', 'H3228H = a group of', 'H3226G', 'ימיני', 'jaminite', 'N:N--PG', 'Jaminite', 'Descendant de Jamin, homme de la tribu de Siméon'),
        (5, 'Greek', 2424, 'G2424', 'G2424G =', 'G2424G', 'Ἰησοῦς', 'Iesous', 'N:N-M-P', 'Jesus', 'Jesus'),
        (6, 'Greek', 5546, 'G5546', 'G5546 = a Group member of', 'G2424G', 'Χριστιανός', 'christianos', 'N:N--T', 'Christian', 'A group member related to Jesus'),
        (7, 'Greek', 4572, 'G4572', 'G4572 = the reflexive of', 'G4771', 'σεαυτοῦ', 'seautou', 'G:P', 'yourself', 'yourself'),
        (8, 'Hebrew', 6213, 'H6213', 'H6213 =', 'H6213', 'עָשָׂה', 'asah', 'V', 'make', 'make'),
        (9, 'Hebrew', 1, 'H0001', 'H0001A =', 'H0001', 'אָב', 'ab', 'N', 'father', 'father'),
        (10, 'Hebrew', 1, 'H0001', 'H0001B =', 'H0001', 'אָב', 'ab', 'N', 'chief', 'chief');
      insert into LexiconTranslations
        (stepEntryId, language, gloss, meaning, meaningHtml)
      values
        (1, 'fr', 'humain', 'être humain, personne', ''),
        (2, 'fr', 'faire le bien', 'faire du bien à quelqu’un', ''),
        (3, 'fr', 'Jamin', 'Jamin = « main droite ». Fils de Siméon, fondateur des Jaminites.', ''),
        (4, 'fr', 'Jaminite', 'Descendant de Jamin, homme de la tribu de Siméon', ''),
        (5, 'fr', 'Jésus', 'Jésus', ''),
        (6, 'fr', 'Chrétien', 'Chrétien, nom donné aux disciples par les païens.', ''),
        (7, 'fr', 'toi-même', 'toi-même', ''),
        (8, 'fr', 'faire', 'faire, produire ou accomplir', ''),
        (9, 'fr', 'père', 'père', ''),
        (10, 'fr', 'chef', 'chef', '');
    `
  ]);
  return dbPath;
}
