import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { readStrongDictionaryTranslationCandidates } from "../src/strongDictionaryLexicon.js";
import {
  buildStrongTranslationLexicon,
  findTranslationCandidate
} from "../src/translationLexicon.js";

test("reads conservative French dictionary candidates from the production schema", async () => {
  const dbPath = await writeTempLexiconDb();

  const candidates = readStrongDictionaryTranslationCandidates(dbPath);

  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.strong === "H0120" &&
        candidate.normalized === "humain" &&
        candidate.method === "dictionary-fr-exact" &&
        candidate.score >= 0.5
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
  assert.ok(findTranslationCandidate(productionLexicon, "H0120", "humain"));
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
  assert.ok(
    findTranslationCandidate(productionLexicon, "H0001", "pere", "H0001A")
  );
  assert.equal(
    findTranslationCandidate(productionLexicon, "H0001", "chef", "H0001A"),
    undefined
  );
  assert.ok(
    findTranslationCandidate(productionLexicon, "H0001", "chef", "H0001B")
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
