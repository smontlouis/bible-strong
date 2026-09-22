import type { CatalogueQuestion } from '../game-catalogue'
export { referenceLabel } from '../game-catalogue'
export type Language = 'fr' | 'en'
export type Copy = { question: string; answer: string; aliases: string[]; explanation: string }
export type Question = CatalogueQuestion
export type Review = { status: 'pending' | 'approved' | 'revise'; note: string }
export type Reviews = Record<string, Review>
export const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
export function nextQuestion(questions: Question[], seen: string[], random = Math.random) {
  const fresh = questions.filter(q => !seen.includes(q.id))
  if (fresh.length) return fresh[Math.floor(random() * fresh.length)]
  return [...questions].sort((a, b) => seen.indexOf(a.id) - seen.indexOf(b.id))[0]
}
export function exactAnswer(q: Question, language: Language, answer: string) {
  return [q[language].answer, ...q[language].aliases].some(a => normalize(a) === normalize(answer))
}
