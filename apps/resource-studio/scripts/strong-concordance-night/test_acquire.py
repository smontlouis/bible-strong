import unittest
from acquire import parse_chapter


def chapter(body):
    return '<span class="verse"><sup class="numverse" id="v1">1</sup><span class="versetxt">' + body + '</span></span>'


class AcquisitionTests(unittest.TestCase):
    def test_balanced_nested_empty_span_keeps_following_text(self):
        result = parse_chapter(chapter('<w data-pa="1/h0001" data-ns="1">Un</w><span class="strong-untranslated"> <w data-pa="2/h0002">◎</w> </span> <w>mot</w>.'))
        self.assertEqual(result['verses'][0]['rawText'], 'Un mot.')
        self.assertTrue(result['verses'][0]['tags'][1]['empty'])

    def test_only_reader_text_not_navigation_or_blank_poetic_spans(self):
        result = parse_chapter(chapter('<w data-pa="1/h0001">A</w>') + '<span class="versetxt"></span><nav>annexe</nav>')
        self.assertEqual(len(result['verses']), 1)
        self.assertEqual(result['verses'][0]['rawText'], 'A')

    def test_poetic_continuation_outside_closed_verse_span(self):
        html = chapter('<w data-pa="1/h0001">A</w>') + '</p><p class="style-q"><w data-pa="2/h0002">B</w>.</span></p><h3>Titre suivant</h3><div class="clearfix">'
        v = parse_chapter(html)['verses'][0]
        self.assertEqual(' '.join(v['rawText'].split()), 'A B.')
        self.assertEqual(len(v['tags']), 2)

    def test_notes_excluded_with_strong_inside_note(self):
        result = parse_chapter(chapter('<w data-pa="1/h0001">A</w><span class="footnote">note</span> <w>B</w>'))
        self.assertEqual(result['verses'][0]['rawText'], 'A B')

    def test_missing_annotation_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'without-strong'):
            parse_chapter(chapter('<w>Texte seul</w>'))

    def test_malformed_body_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'unbalanced'):
            parse_chapter(chapter('<w data-pa="1/h0001">A</bad>'))

    def test_utf16_offsets_and_entities(self):
        v = parse_chapter(chapter('🌿 <w data-pa="1/h0001">l’ami &amp; frère</w>'))['verses'][0]
        self.assertEqual(v['tags'][0]['start'], 3)
        self.assertEqual(v['rawText'], '🌿 l’ami & frère')

    def test_section_titles_and_navigation_are_not_bible_text(self):
        html = chapter('<w data-pa="1/h0001">A</w>') + '<span class="titles style-s">Titre de section</span><a role="button"><span class="material-symbols-outlined">navigate_before</span></a><div class="clearfix">'
        self.assertEqual(parse_chapter(html)['verses'][0]['rawText'], 'A')

    def test_unknown_unwrapped_lexical_content_fails_closed(self):
        with self.assertRaisesRegex(ValueError, 'unwrapped-lexical-text'):
            parse_chapter(chapter('<w data-pa="1/h0001">A</w> texte parasite'))


if __name__ == '__main__':
    unittest.main()
