import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEventTitles,
  applySectionTitles,
  naveTitlesSql,
  titleLetter
} from "./apply-french-titles.mjs";

describe("French titles", () => {
  it("files a title under its first letter, accents aside", () => {
    assert.equal(titleLetter("Foi"), "f");
    assert.equal(titleLetter("Échanson"), "e");
    assert.equal(titleLetter("Âge, vieillesse"), "a");
    assert.equal(titleLetter("Œil"), "o");
  });

  it("keeps the key of a topic and moves it in the list", () => {
    const sql = naveTitlesSql({ faith: "Foi", "d'accord": "L'ami" });
    assert.match(sql, /SET name = 'Foi', letter = 'f' WHERE name_lower = 'faith'/);
    assert.match(sql, /'L''ami'/);
    assert.match(sql, /DROP TABLE IF EXISTS RESOURCE_METADATA/);
  });

  it("changes the title of an event and nothing else", () => {
    assert.deepEqual(
      applyEventTitles([{ slug: "ahab", title: "Ahab", dates: "918 BC" }], { ahab: "Achab" }),
      [{ slug: "ahab", title: "Achab", dates: "918 BC" }]
    );
    assert.deepEqual(
      applySectionTitles(
        [{ id: 1, events: [{ slug: "ahab", title: "Ahab", titleEn: "Ahab" }] }],
        { ahab: "Achab" }
      ),
      [{ id: 1, events: [{ slug: "ahab", title: "Achab", titleEn: "Ahab" }] }]
    );
  });
});
