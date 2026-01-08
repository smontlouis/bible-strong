import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai/react'
import { toast } from 'sonner-native'
import books from '~assets/bible_versions/books-desc'
import { Tag } from '~common/types'
import generateUUID from '~helpers/generateUUID'
import formatVerseContent from '~helpers/formatVerseContent'
import verseToReference from '~helpers/verseToReference'
import { useCreateGroup, useSwitchGroup, useGroupsCount } from '~state/tabGroups'
import {
  tabGroupsAtom,
  TabItem,
  getDefaultBibleTab,
  MAX_TAB_GROUPS,
  GROUP_COLORS,
} from '~state/tabs'
import { Note, Link, Study } from '~redux/modules/user'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'

// Structure d'un verset dans verseIds
interface VerseId {
  Livre: number
  Chapitre: number
  Verset: number
  Texte: string
}

// Type pour les highlights retournés par le sélecteur
interface HighlightData {
  date: number
  color: string
  verseIds: VerseId[]
  stringIds: Record<string, boolean>
  tags: Record<string, { id: string; name: string }>
}

// Type pour les notes retournées par le sélecteur
type NoteWithId = Note & { id: string; reference: string }

// Type pour les links retournés par le sélecteur
type LinkWithId = Link & { id: string }

// Types pour les entités avec id et title (naves, words, strongs)
interface TaggedEntity {
  id: string | number
  title: string
  tags?: Record<string, { id: string; name: string }>
}

// Type pour les données du tag (retour de makeTagDataSelector)
export interface TagData {
  highlights: HighlightData[]
  notes: NoteWithId[]
  links: LinkWithId[]
  studies: Study[]
  naves: TaggedEntity[]
  words: TaggedEntity[]
  strongsGrec: TaggedEntity[]
  strongsHebreu: TaggedEntity[]
}

export const useCreateTabGroupFromTag = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const createGroup = useCreateGroup()
  const switchGroup = useSwitchGroup()
  const groupsCount = useGroupsCount()
  const setTabGroups = useSetAtom(tabGroupsAtom)
  const { slideToIndex } = useTabAnimations()

  const createTabGroupFromTag = (tag: Tag, tagData: TagData) => {
    // Vérifier la limite de groupes
    if (groupsCount >= MAX_TAB_GROUPS) {
      toast.error(t('Limite de groupes atteinte'))
      return false
    }

    // Créer les tabs pour chaque type d'item
    const tabs: TabItem[] = []

    // Highlights → BibleTab
    tagData.highlights.forEach(h => {
      if (h.verseIds?.length) {
        const firstVerse = h.verseIds[0]
        const livre = firstVerse.Livre
        const chapitre = firstVerse.Chapitre
        const verset = firstVerse.Verset

        // Generate title from verse reference (e.g., "Genèse 1:1-5")
        const { title } = formatVerseContent(h.verseIds)

        tabs.push({
          id: `bible-${generateUUID()}`,
          title: title || t('Bible'),
          isRemovable: true,
          type: 'bible',
          data: {
            ...getDefaultBibleTab().data,
            selectedBook: books[livre - 1],
            selectedChapter: chapitre,
            selectedVerse: verset,
            focusVerses: h.verseIds.map(v => Number(v.Verset)),
          },
        })
      }
    })

    // Notes → NotesTab
    tagData.notes.forEach(n => {
      // Use note title if available, otherwise use verse reference
      const noteVerses = n.id.split('/').reduce(
        (acc, key) => {
          acc[key] = true
          return acc
        },
        {} as Record<string, boolean>
      )
      const noteTitle = n.title || verseToReference(noteVerses)

      tabs.push({
        id: `notes-${generateUUID()}`,
        title: noteTitle,
        isRemovable: true,
        type: 'notes',
        data: { noteId: n.id },
      })
    })

    // Strongs Grec → StrongTab
    tagData.strongsGrec.forEach(s => {
      tabs.push({
        id: `strong-${generateUUID()}`,
        title: `${t('Grec')} ${s.title}`,
        isRemovable: true,
        type: 'strong',
        data: { reference: String(s.id) },
      })
    })

    // Strongs Hébreu → StrongTab
    tagData.strongsHebreu.forEach(s => {
      tabs.push({
        id: `strong-${generateUUID()}`,
        title: `${t('Hébreu')} ${s.title}`,
        isRemovable: true,
        type: 'strong',
        data: { reference: String(s.id) },
      })
    })

    // Naves → NaveTab
    tagData.naves.forEach(n => {
      tabs.push({
        id: `nave-${generateUUID()}`,
        title: n.title,
        isRemovable: true,
        type: 'nave',
        data: { name_lower: String(n.id), name: n.title },
      })
    })

    // Words → DictionaryTab
    tagData.words.forEach(w => {
      tabs.push({
        id: `dictionary-${generateUUID()}`,
        title: w.title,
        isRemovable: true,
        type: 'dictionary',
        data: { word: w.title },
      })
    })

    // Studies → StudyTab
    tagData.studies.forEach(s => {
      tabs.push({
        id: `study-${generateUUID()}`,
        title: s.title,
        isRemovable: true,
        type: 'study',
        data: { studyId: s.id },
      })
    })

    // Links → BibleTab (ouvre le verset associé)
    tagData.links.forEach(l => {
      const [livre, chapitre, verset] = l.id.split('-').map(Number)
      // Generate title from verse reference
      const { title: linkTitle } = formatVerseContent([
        { Livre: livre, Chapitre: chapitre, Verset: verset },
      ])

      tabs.push({
        id: `bible-${generateUUID()}`,
        title: linkTitle || t('Bible'),
        isRemovable: true,
        type: 'bible',
        data: {
          ...getDefaultBibleTab().data,
          selectedBook: books[livre - 1],
          selectedChapter: chapitre,
          selectedVerse: verset,
          focusVerses: [verset],
        },
      })
    })

    // Si aucun tab, ajouter un tab Bible par défaut
    if (tabs.length === 0) {
      tabs.push(getDefaultBibleTab())
    }

    // Créer le groupe avec tous les tabs
    const groupId = createGroup({ name: tag.name, color: GROUP_COLORS[0] })
    if (!groupId) return false

    // Remplacer les tabs du groupe (qui a un tab par défaut) par nos tabs
    setTabGroups(groups =>
      groups.map(g => (g.id === groupId ? { ...g, tabs, activeTabIndex: 0 } : g))
    )

    // Switcher vers le nouveau groupe
    switchGroup(groupId)

    // Naviguer vers AppSwitcher
    router.dismissTo('/')

    // Attendre que le layout soit prêt puis ouvrir le premier tab
    setTimeout(() => {
      slideToIndex(0)
    }, 150)

    toast.success(t('tabs.groupCreatedWithCount', { count: tabs.length }))
    return true
  }

  return createTabGroupFromTag
}
