import unittest
from build import scripture, body_slices

class ReadingPlanImportTests(unittest.TestCase):
    def test_references_do_not_copy_or_depend_on_translation(self):
        self.assertEqual(scripture('EXO.34.6-7.PDV2017'), {'type':'Verse','verses':'2|34:6-7'})
        self.assertEqual(scripture('EXO.34.6-7.NIV'), scripture('EXO.34.6-7.PDV2017'))
        self.assertEqual(scripture('JHN.1-3.NIV'), {'type':'Chapter','chapters':'43|1-3'})

    def test_rejects_invalid_passages_instead_of_silently_truncating(self):
        for value in ['JHN.22.NIV','JHN.1.52.NIV','XYZ.1.NIV','JHN.3-1.NIV','JHN.1.5-2.NIV']:
            with self.subTest(value=value), self.assertRaises((AssertionError,ValueError)):
                scripture(value)

    def test_keeps_text_video_and_scripture_order(self):
        result=body_slices('<div class="prose"><p>Before <em>the video</em>.</p><div><iframe src="//www.youtube.com/embed/nxwzq1PJImM"></iframe></div><p>After.</p><ol><li>First question</li><li>Second question</li></ol></div>','en')
        self.assertEqual([s['type'] for s in result],['Text','Video','Text'])
        self.assertEqual(result[0]['description'],'Before the video.')
        self.assertEqual(result[1]['url'],'https://www.youtube.com/watch?v=nxwzq1PJImM')
        self.assertIn('2. Second question',result[2]['description'])

    def test_preserves_both_publisher_video_sources(self):
        result=body_slices('<div class="prose"><video poster="https://example.com/poster.jpg"><source src="https://example.com/playlist.m3u8"><source src="https://example.com/high.webm"></video></div>','en')
        self.assertEqual(result[0]['url'],'https://example.com/playlist.m3u8')
        self.assertEqual(result[0]['webUrl'],'https://example.com/high.webm')

    def test_unknown_embed_is_not_silently_dropped(self):
        with self.assertRaises(AssertionError):
            body_slices('<div class="prose"><iframe src="https://unknown.example/video"></iframe></div>','en')

if __name__=='__main__':unittest.main()
