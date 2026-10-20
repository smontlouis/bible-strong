import unittest

from extract_sword_rich_bibles import merge_chapter_prelude, extract_headings, read_chapter_prelude

# BSB module, CrossWire BSB.zip (sha256 28d0680f…), Colossians 2.
COL_2_PRELUDE = (
    '<chapter n="2" osisID="Col.2" sID="Col.2"/><div eID="gen9" type="x-p"/> '
    "<title>Absent in Body, Present in Spirit</title> "
)
COL_2_1 = (
    '<title type="parallel"> (<reference osisRef="Rev.3.14-Rev.3.22" '
    'type="parallel">Revelation 3:14–22</reference>) </title> '
    '<w lemma="strong:G2309">I want</w> you to know'
)


class FakeStructure:
    def ref_to_indicies(self, books, chapters, verses):
        assert (books, chapters, verses) == (["Colossians"], [2], [1])
        return {"nt": [42]}


class FakeBible:
    def get_structure(self):
        return FakeStructure()

    def _text_for_index(self, testament, index):
        return {("nt", 41): COL_2_PRELUDE, ("nt", 42): COL_2_1}.get((testament, index))


class ChapterPreludeTests(unittest.TestCase):
    def test_reads_the_entry_before_verse_one(self):
        self.assertEqual(read_chapter_prelude(FakeBible(), "nt", "Colossians", 2), COL_2_PRELUDE)

    def test_places_the_section_title_before_the_parallel_reference(self):
        verse_headings, _ = extract_headings(COL_2_1)
        headings = merge_chapter_prelude(COL_2_PRELUDE, verse_headings)
        self.assertEqual(
            [(h["order"], h["type"], h["text"], h.get("sourceEntry")) for h in headings],
            [
                (0, "unspecified", "Absent in Body, Present in Spirit", "chapterPrelude"),
                (1, "parallel", " (Revelation 3:14–22) ", None),
            ],
        )
        self.assertTrue(headings[0]["isPericope"])
        self.assertEqual(headings[0]["sourceMarkup"], "<title>Absent in Body, Present in Spirit</title>")

    def test_empty_prelude_leaves_verse_headings_untouched(self):
        verse_headings, _ = extract_headings(COL_2_1)
        self.assertEqual(merge_chapter_prelude("", verse_headings), verse_headings)

    def test_marks_chapter_labels_for_the_projection(self):
        headings = merge_chapter_prelude(
            '<chapter osisID="Gen.1" sID="gen2"/><title subType="x-Chapter" type="sub">CHAPTER 1</title> ',
            [],
        )
        self.assertEqual(
            [(h["type"], h.get("subType"), h["sourceEntry"]) for h in headings],
            [("sub", "x-Chapter", "chapterPrelude")],
        )


if __name__ == "__main__":
    unittest.main()
