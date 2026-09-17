import type { Plan, ReadingSlice } from '~common/types'
import { getEditorialKind } from '~features/plans/readingCalendar'
import type { ReadingContext } from './conversations'
// Explicit projection: never serialize participation, progress, schedules or user answers.
export function editorialContext(
  plan: Pick<Plan, 'id' | 'title' | 'description' | 'kind' | 'type' | 'lang'> | undefined,
  reading?: ReadingSlice
): ReadingContext | null {
  if (!plan) return null
  const kind = getEditorialKind(plan) === 'daily-meditation' ? 'meditation' : 'plan'
  const label = [plan.title, reading?.title].filter(Boolean).join(' · ').slice(0, 450)
  const parts = reading
    ? reading.slices.flatMap(slice => {
        switch (slice.type) {
          case 'Title':
            return [slice.title]
          case 'Text':
            return [slice.title || '', slice.description]
          case 'Verse':
            return [`Références bibliques : ${slice.verses}`]
          case 'Chapter':
            return [`Chapitres bibliques : ${slice.chapters}`]
          case 'Video':
            return [
              `Vidéo : ${slice.title}. ${slice.description || ''} (transcription non fournie)`,
            ]
          case 'Image':
            return slice.alt ? [`Illustration : ${slice.alt}`] : []
          default:
            return []
        }
      })
    : [plan.description || '']
  const text = parts.filter(Boolean).join('\n\n')
  return {
    kind,
    label,
    key: `${kind}:${plan.id}:${reading?.id || 'overview'}`,
    detail:
      `${kind === 'plan' ? 'Plan de lecture' : 'Méditation'} : ${label}. Ressource=${plan.id}; étape=${reading?.id || 'présentation'}; langue=${plan.lang}`.slice(
        0,
        500
      ),
    content:
      text.length > 12000
        ? text.slice(0, 11900) + '\n[Extrait tronqué ; la suite du contenu n’est pas fournie.]'
        : text,
  }
}
