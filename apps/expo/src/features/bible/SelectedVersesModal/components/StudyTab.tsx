import { resolveUniverseColors } from '~themes/universeColors'
import { useTheme } from '~themes/ThemeProvider'
import { useTranslation } from 'react-i18next'
import ActionsLayout from './ActionsLayout'
import ActionItem from './ActionItem'
import { formatShortcut } from '~features/keyboard-shortcuts/keymap'
interface StudyTabProps {
  screenWidth: number
  /** Holds the selected verses in the reader's focus, where their study gathers (ADR-0088). */
  onPinVerses: () => void
  hasFocus: boolean
  showStrongDetail: () => void
  showDictionaryDetail: () => void
  onOpenNave: () => void
  onOpenReferences: () => void
  openCommentariesScreen: () => void
  compareVerses: () => void
  moreThanOneVerseSelected: boolean
}

const StudyTab = ({
  screenWidth,
  onPinVerses,
  hasFocus,
  showStrongDetail,
  showDictionaryDetail,
  onOpenNave,
  onOpenReferences,
  openCommentariesScreen,
  compareVerses,
  moreThanOneVerseSelected,
}: StudyTabProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <ActionsLayout width={screenWidth}>
      {/* The door to the whole study comes first; once the focus is on, the tile shows it as
          selected instead of filled, since a filled tile would hide the selected border. */}
      <ActionItem
        name="zoom-in"
        label={t('Approfondir')}
        onPress={onPinVerses}
        isActive={hasFocus}
        variant={hasFocus ? 'default' : 'emphasized'}
        shortcut={formatShortcut('focus')}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/lexique.svg')}
        tintColor={resolveUniverseColors(theme.colors, 'strong').foreground}
        label={t('Lexique')}
        onPress={showStrongDetail}
        disabled={moreThanOneVerseSelected}
        shortcut={formatShortcut('lexicon')}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/dictionary.svg')}
        tintColor={resolveUniverseColors(theme.colors, 'dictionary').foreground}
        label={t('Dictionnaire')}
        onPress={showDictionaryDetail}
        disabled={moreThanOneVerseSelected}
        shortcut={formatShortcut('dictionary')}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/nave.svg')}
        tintColor={resolveUniverseColors(theme.colors, 'nave').foreground}
        label={t('Thèmes')}
        onPress={onOpenNave}
        disabled={moreThanOneVerseSelected}
        shortcut={formatShortcut('topics')}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/references.svg')}
        tintColor={resolveUniverseColors(theme.colors, 'references').foreground}
        label={t('Références')}
        onPress={onOpenReferences}
        disabled={moreThanOneVerseSelected}
        shortcut={formatShortcut('references')}
      />
      <ActionItem
        svgSource={require('~assets/images/tab-icons/comment.svg')}
        tintColor={resolveUniverseColors(theme.colors, 'commentary').foreground}
        label={t('Commentaire')}
        onPress={openCommentariesScreen}
        disabled={moreThanOneVerseSelected}
        shortcut={formatShortcut('commentary')}
      />
      <ActionItem
        name="layers"
        label={t('Comparer')}
        onPress={compareVerses}
        shortcut={formatShortcut('compare')}
      />
    </ActionsLayout>
  )
}

export default StudyTab
