import {
  compareStrongDefinitions,
  isRedundantStrongDefinition,
} from '../strongDefinitionComparison'
const compare = (simpleHtml: string, detailedHtml: string) =>
  compareStrongDefinitions({ simpleHtml, detailedHtml, gloss: '' })

it('masks H5175 at 70.6% word similarity', () => {
  const result = compare(
    '1) serpent, reptile 1a) serpent 1b) image (du serpent) 1c) serpent volant (mythologique)',
    '1) serpent 1a) serpent 1b) image (de serpent) 1c) serpent fuyard (mythologique)'
  )
  expect(result.similarity).toBeCloseTo(12 / 17)
  expect(result.redundant).toBe(true)
})
it('accepts 70 percent and retains less similar definitions', () => {
  expect(compare('a b c d e f g h i j', 'a b c d e f g x y z').redundant).toBe(true)
  expect(compare('a b c d e f g h i j', 'a b c d e f x y z w').redundant).toBe(false)
})
it('preserves significant additional content despite high similarity', () => {
  const simple = 'one two three four five six seven eight nine ten'
  expect(compare(simple, simple + ' eleven twelve thirteen')).toMatchObject({
    redundant: false,
    reason: 'additional-content',
  })
  expect(compare(simple, simple + ' eleven twelve').redundant).toBe(true)
})
it('normalizes HTML, list markers, case, spacing and visible gloss', () => {
  expect(
    isRedundantStrongDefinition({
      simpleHtml: '<p>1) Woman, wife.</p>',
      detailedHtml: ': woman<br>woman, wife',
      gloss: 'woman',
    })
  ).toBe(true)
  expect(
    compare(
      '<p>1) femme<br /><img src="/Design/ClearPix.gif" />1a) épouse de l’homme</p>',
      "1) femme 1a) épouse de l'homme"
    ).redundant
  ).toBe(true)
})
it('preserves different references and nondecorative media', () => {
  expect(compare('woman', '<a href="strong://H0802H">woman</a>').reason).toBe('references')
  expect(compare('woman', 'woman<img src="illustration.png" />').redundant).toBe(false)
})
it('counts repeated words and preserves order', () => {
  expect(compare('one two three four', 'four three two one').redundant).toBe(false)
  expect(compare('one one one two', 'one two two two').similarity).toBe(0.5)
})
it('does not hide missing simple definitions or distinct English etymologies', () => {
  expect(compare('', 'woman').redundant).toBe(false)
  expect(compare('<p>&nbsp;</p>', '<p>&nbsp;</p>').redundant).toBe(false)
  expect(compare('The feminine of H376; a woman.', 'woman wife female').redundant).toBe(false)
})
it('bounds computation and retains oversized definitions', () => {
  expect(compare('word '.repeat(501), 'word '.repeat(500) + 'other').reason).toBe('budget')
  expect(compare('x'.repeat(33000), 'x'.repeat(33000)).reason).toBe('budget')
})
it('reuses only identical comparison inputs', () => {
  const first = compare('cached simple', 'cached detail')
  expect(compare('cached simple', 'cached detail')).toBe(first)
  expect(compare('cached simple', 'another detail')).not.toBe(first)
})
