import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform, StyleSheet } from 'react-native'
import { personalContentIcons } from '~common/personalContent'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { formatShortcut } from '~features/keyboard-shortcuts/keymap'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import ActionItem from './SelectedVersesModal/components/ActionItem'
import ActionsLayout from './SelectedVersesModal/components/ActionsLayout'
import { useSelectionMenu } from './SelectedVersesModal/selectionMenuContext'
import StrongWordItem from './StrongWordItem'
import type { SelectionStrongWordPreview, SelectionStrongWords } from './useSelectionStrongWords'

const withCount = (label: string, count: number) => (count > 0 ? `${label} · ${count}` : label)

type AnnotationAnnotateTabProps = {
  screenWidth: number
  hasNote: boolean
  tagsCount: number
  relationsCount: number
  noteDisabled: boolean
  tagsDisabled: boolean
  relationsDisabled: boolean
  onNotePress: () => void
  onTagsPress: () => void
  onRelationsPress: () => void
  /** Deletes the open annotation, or erases those under the selected words. */
  erase?: () => void
  /** An annotation is open: erasing deletes it. */
  isAnnotation: boolean
  /** Desktop menu: the tags open as a screen of the menu. */
  tagsNested?: boolean
}

/** What the words' annotation holds: its note, tags and relations, and the way to remove it. */
export const AnnotationAnnotateTab = ({
  screenWidth,
  hasNote,
  tagsCount,
  relationsCount,
  noteDisabled,
  tagsDisabled,
  relationsDisabled,
  onNotePress,
  onTagsPress,
  onRelationsPress,
  erase,
  isAnnotation,
  tagsNested,
}: AnnotationAnnotateTabProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <ActionsLayout width={screenWidth}>
      <ActionItem
        name={hasNote ? personalContentIcons.notes : 'file-plus'}
        tintColor={resolveUniverseColors(theme.colors, 'notes').foreground}
        label={t('Note')}
        onPress={onNotePress}
        disabled={noteDisabled}
        isActive={hasNote}
        shortcut={formatShortcut('note')}
      />
      <ActionItem
        name={personalContentIcons.tags}
        tintColor={resolveUniverseColors(theme.colors, 'tags').foreground}
        label={withCount(t('Tag'), tagsCount)}
        onPress={onTagsPress}
        disabled={tagsDisabled}
        isActive={tagsCount > 0}
        shortcut={formatShortcut('tags')}
        nested={tagsNested}
      />
      <ActionItem
        name="git-merge"
        label={withCount(t('Relation'), relationsCount)}
        onPress={onRelationsPress}
        disabled={relationsDisabled}
        isActive={relationsCount > 0}
        shortcut={formatShortcut('relation')}
      />
      <ActionItem
        name="trash-2"
        tintColor={theme.colors.quart}
        label={isAnnotation ? t('Supprimer') : t('Effacer')}
        onPress={() => erase?.()}
        disabled={!erase}
        shortcut={formatShortcut('erase')}
      />
    </ActionsLayout>
  )
}

/** Between the study of the verses and the words: a hairline across the menu, down the sheet. */
const StudySeparator = () => {
  const menu = useSelectionMenu()
  if (menu) {
    return (
      <Box
        className="bg-separator mx-[10px] my-[4px]"
        style={{ height: StyleSheet.hairlineWidth }}
      />
    )
  }
  if (Platform.OS === 'web') return null
  return (
    <Box
      className="bg-separator mt-[12px] ml-[4px] mr-[12px] h-[48px]"
      style={{ width: StyleSheet.hairlineWidth }}
    />
  )
}

const StudyMessage = ({ text }: { text: string }) => {
  const menu = useSelectionMenu()
  return (
    <Box className={menu ? 'px-[10px] py-[6px]' : 'pt-[14px] w-[220px]'}>
      <Text className="text-[13px] leading-[17px] text-grey">{text}</Text>
    </Box>
  )
}

type AnnotationStudyTabProps = {
  screenWidth: number
  hasFocus: boolean
  focusDisabled: boolean
  onFocus: () => void
  version?: string
  strongWords: SelectionStrongWords
  onOpenWord: (word: SelectionStrongWordPreview) => void
}

/**
 * The study of the words: their verses in focus first, as for selected verses, then the Hebrew or
 * Greek word under each word of the text, which opens its entry.
 */
export const AnnotationStudyTab = ({
  screenWidth,
  hasFocus,
  focusDisabled,
  onFocus,
  version,
  strongWords,
  onOpenWord,
}: AnnotationStudyTabProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const message =
    strongWords.status === 'none'
      ? t('Sélectionnez des mots pour voir leur hébreu ou leur grec.')
      : strongWords.status === 'unsupported'
        ? t('Les mots de la {{version}} ne sont pas reliés aux numéros Strong.', { version })
        : strongWords.status === 'unavailable'
          ? t('bibleDisplayMode.connectionRequired')
          : strongWords.status === 'available' && strongWords.words.length === 0
            ? t('Aucun mot hébreu ou grec dans la sélection.')
            : undefined

  return (
    <ActionsLayout width={screenWidth}>
      <ActionItem
        name="zoom-in"
        label={t('Approfondir')}
        onPress={onFocus}
        disabled={focusDisabled}
        isActive={hasFocus}
        shortcut={formatShortcut('focus')}
      />
      <StudySeparator />
      {strongWords.status === 'loading' ? (
        <Box className="pt-[30px] px-[16px]">
          <ActivityIndicator color={theme.colors.grey} />
        </Box>
      ) : message ? (
        <StudyMessage text={message} />
      ) : strongWords.status === 'available' ? (
        strongWords.words.map(word => (
          <StrongWordItem key={word.key} word={word} onPress={() => onOpenWord(word)} />
        ))
      ) : null}
    </ActionsLayout>
  )
}

type AnnotationShareTabProps = {
  screenWidth: number
  disabled: boolean
  onCopy: () => void
  onShare: () => void
}

/** The words themselves, quoted with their reference. */
export const AnnotationShareTab = ({
  screenWidth,
  disabled,
  onCopy,
  onShare,
}: AnnotationShareTabProps) => {
  const { t } = useTranslation()
  return (
    <ActionsLayout width={screenWidth}>
      <ActionItem
        name="copy"
        label={t('Copier')}
        onPress={onCopy}
        disabled={disabled}
        shortcut={formatShortcut('copy')}
      />
      <ActionItem name="share-2" label={t('Partager')} onPress={onShare} disabled={disabled} />
    </ActionsLayout>
  )
}
