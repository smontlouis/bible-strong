import { editorialContext } from '../editorialContext'
it('projects only editorial content and the open step', () => {
  const plan = {
    id: 'p',
    title: 'Plan public',
    description: 'Présentation',
    kind: 'reading-plan' as const,
    type: 'reading-plan' as const,
    lang: 'fr' as const,
    progress: 0.7,
    startDate: 'PRIVATE',
    notes: 'PRIVATE',
  }
  const reading = {
    id: 'r',
    title: 'Étape',
    status: 'Completed' as const,
    slices: [{ id: 's', type: 'Text' as const, description: 'Texte éditorial' }],
  }
  const result = editorialContext(plan, reading)
  expect(result?.kind).toBe('plan')
  expect(result?.content).toBe('Texte éditorial')
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|progress|Completed/)
  expect(result?.key).not.toBe(editorialContext(plan)?.key)
})
it('bounds the meditation and explicitly marks omitted content', () => {
  const result = editorialContext(
    { id: 'p', title: 'Méditation', kind: 'daily-meditation', type: 'meditation', lang: 'fr' },
    { id: 'r', slices: [{ id: 's', type: 'Text', description: 'a'.repeat(14000) }] }
  )
  expect(result?.kind).toBe('meditation')
  expect(result!.content!.length).toBeLessThanOrEqual(12000)
  expect(result?.content).toContain('tronqué')
  expect(editorialContext(undefined)).toBeNull()
})
