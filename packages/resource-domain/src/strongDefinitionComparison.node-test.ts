import assert from 'node:assert/strict'
import { it } from 'node:test'

import { compareStrongDefinitions, isRedundantStrongDefinition } from './strongDefinitionComparison'

const compare = (simpleHtml: string, detailedHtml: string) =>
  compareStrongDefinitions({ simpleHtml, detailedHtml, gloss: '' })

it('masks H5175 at 70.6% word similarity', () => {
  const result = compare(
    '1) serpent, reptile 1a) serpent 1b) image (du serpent) 1c) serpent volant (mythologique)',
    '1) serpent 1a) serpent 1b) image (de serpent) 1c) serpent fuyard (mythologique)'
  )
  assert.ok(Math.abs((result.similarity ?? 0) - 12 / 17) < 1e-9)
  assert.equal(result.redundant, true)
})
it('accepts 70 percent and retains less similar definitions', () => {
  assert.equal(compare('a b c d e f g h i j', 'a b c d e f g x y z').redundant, true)
  assert.equal(compare('a b c d e f g h i j', 'a b c d e f x y z w').redundant, false)
})
it('preserves significant additional content despite high similarity', () => {
  const simple = 'one two three four five six seven eight nine ten'
  const extended = compare(simple, simple + ' eleven twelve thirteen')
  assert.equal(extended.redundant, false)
  assert.equal(extended.reason, 'additional-content')
  assert.equal(compare(simple, simple + ' eleven twelve').redundant, true)
})
it('normalizes HTML, list markers, case, spacing and visible gloss', () => {
  assert.equal(
    isRedundantStrongDefinition({
      simpleHtml: '<p>1) Woman, wife.</p>',
      detailedHtml: ': woman<br>woman, wife',
      gloss: 'woman',
    }),
    true
  )
  assert.equal(
    compare(
      '<p>1) femme<br /><img src="/Design/ClearPix.gif" />1a) épouse de l’homme</p>',
      "1) femme 1a) épouse de l'homme"
    ).redundant,
    true
  )
})
it('preserves different references and nondecorative media', () => {
  assert.equal(compare('woman', '<a href="strong://H0802H">woman</a>').reason, 'references')
  assert.equal(compare('woman', 'woman<img src="illustration.png" />').redundant, false)
})
it('counts repeated words and preserves order', () => {
  assert.equal(compare('one two three four', 'four three two one').redundant, false)
  assert.equal(compare('one one one two', 'one two two two').similarity, 0.5)
})
it('does not hide missing simple definitions or distinct English etymologies', () => {
  assert.equal(compare('', 'woman').redundant, false)
  assert.equal(compare('<p>&nbsp;</p>', '<p>&nbsp;</p>').redundant, false)
  assert.equal(compare('The feminine of H376; a woman.', 'woman wife female').redundant, false)
})
it('bounds computation and retains oversized definitions', () => {
  assert.equal(compare('word '.repeat(501), 'word '.repeat(500) + 'other').reason, 'budget')
  assert.equal(compare('x'.repeat(33000), 'x'.repeat(33000)).reason, 'budget')
})
it('reuses only identical comparison inputs', () => {
  const first = compare('cached simple', 'cached detail')
  assert.equal(compare('cached simple', 'cached detail'), first)
  assert.notEqual(compare('cached simple', 'another detail'), first)
})
