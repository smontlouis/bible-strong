import unittest
from collect import Parser

class PoemTests(unittest.TestCase):
 def test_preserves_verses_and_strophes_without_splitting_inline_emphasis(self):
  p=Parser();p.feed('<div class="texte"><p><div class="strophe"><div class="vers">Une <em>ligne</em></div><div class="vers">Une autre ligne</div></div></p><p>Un paragraphe.</p></div>')
  text=p.root.find(lambda n:n.attrs.get('class')=='texte')[0].text()
  self.assertIn('Une ligne\nUne autre ligne',text)
  self.assertIn('\n\nUn paragraphe.',text)
if __name__=='__main__':unittest.main()
