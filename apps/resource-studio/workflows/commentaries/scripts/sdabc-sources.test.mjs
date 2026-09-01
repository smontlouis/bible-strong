import assert from "node:assert/strict";
import test from "node:test";
import {
  parseChapterCommentary,
  repairGenesis39HistoricalOutline,
  selectBiblePdfs,
  sha256,
  splitBookChapters,
  splitCombinedJohn
} from "./sdabc-sources.mjs";

test("selectBiblePdfs couvre le fichier combiné 2–3 Jean", () => {
  const files = Array.from({ length: 62 }, (_, index) => ({
    name: `SdaBc-1 (${String(index + 1).padStart(2, "0")}) Book.pdf`,
    size: "1"
  }));
  files.push({ name: "SdaBc-7 (63-64) 2-3 John.pdf", size: "2" });
  files.push(
    { name: "SdaBc-7 (65) Jude.pdf", size: "1" },
    { name: "SdaBc-7 (66) Revelation.pdf", size: "1" }
  );
  const selected = selectBiblePdfs({ files });
  assert.equal(selected.length, 65);
  assert.deepEqual(
    selected.find((file) => file.firstBook === 63),
    expectCombined()
  );
});

const expectCombined = () => ({
  volume: 7,
  firstBook: 63,
  lastBook: 64,
  name: "SdaBc-7 (63-64) 2-3 John.pdf",
  size: 2,
  url: "https://archive.org/download/SdaBibleCommentary1980/SdaBc-7%20(63-64)%202-3%20John.pdf"
});

test("parse le commentaire, conserve les paragraphes et exclut le supplément EGW", () => {
  const text = `CHAPTER 1\n1 The creation.\n\n    1. In the beginning. First paragraph.\ncontinued.\n\nSecond paragraph.\n    2. Without form. More text.\n ELLEN G. WHITE COMMENTS\n 1-3 PP 44`;
  const [chapter] = splitBookChapters({ text, chapterCount: 1 });
  const entries = parseChapterCommentary({
    text: chapter.text,
    book: 1,
    chapter: 1,
    maxVerse: 31
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].passage, "1-1-1");
  assert.match(
    entries[0].source.html,
    /First paragraph\. continued\.<\/p><p>Second paragraph\./
  );
  assert.doesNotMatch(entries[1].source.html, /PP 44/);
});

test("ignore les rubriques numérotées de l’introduction d’un livre à un chapitre", () => {
  const text = `1. Title. Intro\n5. Outline.\nI. Greeting, 1-3.\n    1. Paul. Commentary.\n    2. Beloved. More.\nELLEN G. WHITE COMMENTS`;
  const [chapter] = splitBookChapters({ text, chapterCount: 1 });
  const entries = parseChapterCommentary({
    text: chapter.text,
    book: 57,
    chapter: 1,
    maxVerse: 25,
    singleChapterBook: true
  });
  assert.equal(entries.length, 2);
  assert.match(entries[0].source.html, /Paul\. Commentary/);
  assert.doesNotMatch(entries[0].source.html, /Title\. Intro/);
});

test("sépare 2 et 3 Jean", () => {
  const split = splitCombinedJohn(
    "The Second Epistle of JOHN\nA\nThe Third Epistle of JOHN\nB"
  );
  assert.match(split[63], /Second/);
  assert.doesNotMatch(split[63], /Third/);
  assert.match(split[64], /Third/);
});

test("ignore un numéro de page OCR placé avant le verset suivant", () => {
  const text = `    1. First. Text.\n25. Running page text.\n    2. Second. Text.\n    3. Third. Text.`;
  const entries = parseChapterCommentary({
    text,
    book: 45,
    chapter: 8,
    maxVerse: 39
  });
  assert.deepEqual(
    entries.map((entry) => entry.passage),
    ["45-8-1", "45-8-2", "45-8-3"]
  );
});

test("répare le plan historique de Genèse 39 sans le prendre pour sept versets", () => {
  const make = (verse, html) => ({
    id: `sdabc:1-39-${verse}:${verse}`,
    passage: `1-39-${verse}`,
    passageEndVerse: verse,
    source: { language: "en", html, sha256: sha256(html) }
  });
  const entries = [
    make(1, "<p>Down to Egypt. Evidence follows: 1. Chronology.</p>"),
    make(
      2,
      "<p>The horse and chariot were introduced into Egypt by the Hyksos.</p>"
    ),
    make(3, "<p>Potiphar was an Egyptian.</p>"),
    make(4, "<p>Joseph served Hyksos kings.</p>"),
    make(5, "<p>Avaris lay near Goshen.</p>"),
    make(6, "<p>A new king arose.</p>"),
    make(7, "<p>Egyptian records were destroyed.</p>"),
    make(
      8,
      "<p>Private ownership changed.</p><p>An Egyptian. Real verse one. 2. The Lord was with Joseph. Real verse two. 6. A goodly person, and well favoured. Real verse six. 7. His master’s wife. Real verse seven.</p>"
    ),
    make(10, "<p>She spake to Joseph.</p>")
  ];
  const repaired = repairGenesis39HistoricalOutline(entries);
  assert.deepEqual(
    repaired.map((entry) => entry.passage),
    ["1-39-1", "1-39-2", "1-39-6", "1-39-7", "1-39-10"]
  );
  assert.match(
    repaired[0].source.html,
    /Private ownership changed.*An Egyptian\. Real verse one/su
  );
  assert.equal(
    repaired[1].source.html,
    "<p>The Lord was with Joseph. Real verse two.</p>"
  );
  assert.equal(
    repaired[2].source.html,
    "<p>A goodly person, and well favoured. Real verse six.</p>"
  );
  assert.equal(
    repaired[3].source.html,
    "<p>His master’s wife. Real verse seven.</p>"
  );
  assert.equal(repaired[1].source.sha256, sha256(repaired[1].source.html));
});
