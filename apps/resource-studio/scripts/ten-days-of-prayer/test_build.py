import json,pathlib,re,unittest
from bs4 import BeautifulSoup
from build import OUT,clean_paragraphs,html_text,from_pdf,normalize

class PrayerImportTests(unittest.TestCase):
 def test_keeps_html_prayer_lists_and_inline_words(self):
  node=BeautifulSoup('<div><p>Pray <em>with faith</em>.</p><ol><li>Give thanks.</li><li>Ask for help.</li></ol></div>','html.parser').div
  text=clean_paragraphs(html_text(node))
  self.assertIn('Pray with faith.',text)
  self.assertIn('1. Give thanks.',text)
  self.assertIn('2. Ask for help.',text)
 def test_normalizes_known_pdf_bullets_and_ligatures(self):
  self.assertEqual(normalize('\uf0b7 Faith\ufb01lled\xa0prayer'),'• Faithfilled prayer')
  self.assertEqual(normalize('\uf0fc Give thanks'),'✓ Give thanks')
 def test_all_twelve_editions_have_exactly_ten_distinct_days(self):
  docs=json.loads((OUT/'documents.json').read_text())
  sections=[d['data'] for d in docs if '/plan-sections/' in d['path']]
  self.assertEqual(len(sections),12)
  for section in sections:
   self.assertEqual([r['id'] for r in section['readingSlices']],[f'day-{d:02}' for d in range(1,11)])
   self.assertTrue(all(len(r['slices'][0]['description'])>500 for r in section['readingSlices']))
 def test_keeps_old_pdf_prayer_bullets_separate_from_headings(self):
  rows=json.loads((OUT/'readings.json').read_text())
  row=next(r for r in rows if (r['year'],r['lang'],r['day'])==(2016,'en',1))
  self.assertIn('Praise (approximately 10 minutes)\n\n• Begin your prayer time',row['text'])
  self.assertIn('\n\n• Praise God that He will teach you',row['text'])
 def test_preserves_complete_source_page_ranges_without_day_eleven(self):
  rows=json.loads((OUT/'readings.json').read_text())
  self.assertEqual(len(rows),120)
  for year,first,last in [(2026,11,51),(2023,23,42),(2016,12,41)]:
   pages=[p for r in rows if r['year']==year and r['lang']=='fr' for p in r['sourcePages']]
   self.assertEqual(pages,list(range(first,last+1)))
  for row in rows:
   self.assertNotRegex(row['text'],r'(?im)^(?:Day (?:11|Eleven)|(?:11ème|Onzième) jour)\b')
if __name__=='__main__':unittest.main()
