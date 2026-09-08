import { useTheme } from '~themes/ThemeProvider'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PanelNavigationContext } from '~common/ContextualPanel/NavigationContext'
import type { PanelScreen } from '~common/ContextualPanel/types'
import FilterChoices from '~common/FilterChoices'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import MultipleChoiceFilterModal from '~common/MultipleChoiceFilterModal'
import {
  SheetFooter,
  SheetHeader,
  SheetScrollView,
  type SheetFooterProps,
  type SheetRef,
} from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import type { VerseIds } from '~common/types'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { versions } from '~helpers/bibleVersions'
import { toast } from '~helpers/toast'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { loadBibleVerseTexts } from '~features/resources/resourceQueries'
import type { RootState } from '~redux/modules/reducer'
import type { VersionCode } from '~state/tabs'
import {
  createPassageExport,
  type PassageExportOptions,
  type PassageExportResult,
  type PassageExportScope,
} from './createPassageExport'
type PassageExportSource =
  | {
      sourceType: 'selection'
      selectedVerses: VerseIds
      bookNumber?: never
      chapterNumber?: never
    }
  | {
      sourceType: 'chapter'
      bookNumber: number
      chapterNumber: number
      selectedVerses?: never
    }

type PassageExportSheetProps = PassageExportSource & {
  inline?: boolean
  version: VersionCode
}

const ALL_EXPORT_SCOPES = ['selection', 'chapter', 'book'] as const
const CHAPTER_EXPORT_SCOPES = ['chapter', 'book'] as const
const PREPARE_DEBOUNCE_MS = 150
const PREPARE_TIMEOUT_MS = 15_000
const PREVIEW_MAX_CHARACTERS = 1600

type ExportFilterButtonProps = {
  screen?: PanelScreen
  label: string
  value: string
  onPress: () => void
}

const ExportFilterButton = ({ label, value, onPress, screen }: ExportFilterButtonProps) => {
  const navigation = useContext(PanelNavigationContext)
  return (
    <TouchableBox
      className="border-continuous overflow-hidden flex-[1] min-w-[0px] p-[13px] border-[1px] border-border rounded-[14px]"
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={() => (screen && navigation?.openScreen ? navigation.openScreen(screen) : onPress())}
    >
      <Text className="font-bold text-[11px] text-grey" numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      <Box className="overflow-hidden border-continuous flex-row items-center mt-[5px] gap-[6px]">
        <Text className="flex-[1] font-bold text-[14px]" numberOfLines={1}>
          {value}
        </Text>
        <FeatherIcon name="chevron-down" size={16} color="grey" />
      </Box>
    </TouchableBox>
  )
}

const safeFilename = (reference: string) =>
  reference
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

const PassageExportSheet = forwardRef<SheetRef, PassageExportSheetProps>(
  ({ selectedVerses, bookNumber, chapterNumber, sourceType, version, inline = false }, ref) => {
    const [inlineView, setInlineView] = useState<'scope' | 'content' | null>(null)
    const sheetRef = useRef<SheetRef>(null)
    const scopeSheetRef = useRef<SheetRef>(null)
    const contentSheetRef = useRef<SheetRef>(null)
    const generationQueueRef = useRef<Promise<void>>(Promise.resolve())
    const { t } = useTranslation()
    const resources = useResourceAccess()
    const theme = useTheme()
    const insets = useSafeAreaInsets()
    const notes = useSelector((state: RootState) => state.user.bible.notes)
    const links = useSelector((state: RootState) => state.user.bible.links)
    const relations = useSelector((state: RootState) => state.user.bible.relations)
    const wordAnnotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
    const studies = useSelector((state: RootState) => state.user.bible.studies)
    const highlights = useSelector((state: RootState) => state.user.bible.highlights)
    const strongsGrec = useSelector((state: RootState) => state.user.bible.strongsGrec)
    const strongsHebreu = useSelector((state: RootState) => state.user.bible.strongsHebreu)
    const naves = useSelector((state: RootState) => state.user.bible.naves)
    const words = useSelector((state: RootState) => state.user.bible.words)
    const sync = useSelector((state: RootState) => state.user.sync)
    const userId = useSelector((state: RootState) => state.user.id)
    const initialScope: PassageExportScope = sourceType === 'chapter' ? 'chapter' : 'selection'
    const availableScopes = sourceType === 'chapter' ? CHAPTER_EXPORT_SCOPES : ALL_EXPORT_SCOPES
    const [scope, setScope] = useState<PassageExportScope>(initialScope)
    const [options, setOptions] = useState<PassageExportOptions>({
      bibleText: true,
      notes: true,
      links: true,
      relations: true,
      tags: true,
    })
    const [result, setResult] = useState<PassageExportResult | null>(null)
    const [isPresented, setIsPresented] = useState(inline)
    const [isPreparing, setIsPreparing] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const versionName = versions[version]?.name || version
    const hasIncompleteSync =
      Boolean(userId) && (sync.isLoading || !Object.values(sync.loaded).every(Boolean))
    const scopeLabels: Record<PassageExportScope, string> = {
      selection: t('passageExport.scope.selection'),
      chapter: t('passageExport.scope.chapter'),
      book: t('passageExport.scope.book'),
    }
    const scopeOptions = availableScopes.map(value => ({ value, label: scopeLabels[value] }))
    const contentOptions: { key: keyof PassageExportOptions; label: string }[] = [
      { key: 'bibleText', label: t('passageExport.content.bibleText') },
      { key: 'notes', label: t('Notes') },
      { key: 'links', label: t('Liens') },
      { key: 'relations', label: t('Relations') },
      { key: 'tags', label: t('passageExport.content.tags') },
    ]
    const selectedContentLabels = contentOptions
      .filter(option => options[option.key])
      .map(option => option.label)
    const selectedContentValues = contentOptions
      .filter(option => options[option.key])
      .map(option => option.key)
    const contentSummary =
      selectedContentLabels.length === contentOptions.length
        ? t('Tout')
        : selectedContentLabels.length
          ? `${selectedContentLabels.slice(0, 2).join(', ')}${selectedContentLabels.length > 2 ? ` +${selectedContentLabels.length - 2}` : ''}`
          : t('passageExport.content.none')

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      presentAt: snapPoint => sheetRef.current?.presentAt(snapPoint),
      resizeTo: snapPoint => sheetRef.current?.resizeTo(snapPoint),
      dismiss: () => sheetRef.current?.dismiss(),
      close: () => sheetRef.current?.close(),
      forceClose: () => sheetRef.current?.forceClose(),
    }))

    useEffect(() => {
      if (!isPresented) {
        setResult(null)
        setIsPreparing(false)
        return
      }

      const exportVerseKeys = Object.keys(selectedVerses || {})
      if (sourceType === 'selection' && !exportVerseKeys.length) {
        setResult(null)
        setIsPreparing(false)
        return
      }

      let cancelled = false
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      setIsPreparing(true)
      setResult(null)

      const debounceId = setTimeout(() => {
        const generation = generationQueueRef.current.then(async () => {
          if (cancelled) throw new Error('Passage export preparation cancelled')
          let timedOut = false
          const preparation = createPassageExport({
            scope,
            selectedVerseKeys: exportVerseKeys,
            scopeContext:
              sourceType === 'chapter' ? { book: bookNumber, chapter: chapterNumber } : undefined,
            version: { code: version, name: versionName },
            options,
            data: {
              notes,
              links,
              relations,
              wordAnnotations,
              studies,
              highlights,
              strongsGrec,
              strongsHebreu,
              naves,
              words,
            },
            loadVerseTexts: verseKeys =>
              loadBibleVerseTexts(resources, version, verseKeys, () => cancelled || timedOut),
          })
          const timeout = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              timedOut = true
              reject(new Error('Passage export preparation timed out'))
            }, PREPARE_TIMEOUT_MS)
          })

          try {
            return await Promise.race([preparation, timeout])
          } finally {
            if (timeoutId) clearTimeout(timeoutId)
          }
        })
        generationQueueRef.current = generation.then(
          () => undefined,
          () => undefined
        )

        generation
          .then(nextResult => {
            if (!cancelled) setResult(nextResult)
          })
          .catch(error => {
            if (!cancelled) {
              setResult(null)
              toast.error(
                error instanceof Error && error.message.includes('timed out')
                  ? t('passageExport.prepareTimeout')
                  : t('passageExport.prepareError')
              )
            }
          })
          .finally(() => {
            if (!cancelled) setIsPreparing(false)
          })
      }, PREPARE_DEBOUNCE_MS)

      return () => {
        cancelled = true
        clearTimeout(debounceId)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }, [
      isPresented,
      scope,
      options,
      sourceType,
      selectedVerses,
      bookNumber,
      chapterNumber,
      version,
      versionName,
      notes,
      links,
      relations,
      wordAnnotations,
      studies,
      highlights,
      strongsGrec,
      strongsHebreu,
      naves,
      words,
      resources,
      t,
    ])

    const toggleOption = (key: keyof PassageExportOptions) => {
      setResult(null)
      if (isPresented) setIsPreparing(true)
      setOptions(current => ({ ...current, [key]: !current[key] }))
    }

    const hasContent = Boolean(
      result &&
      (result.verseKeys.length ||
        result.counts.notes ||
        result.counts.links ||
        result.counts.relations ||
        result.counts.tags)
    )

    const exportFile = async () => {
      if (!result || !hasContent) return
      setIsExporting(true)
      let fileUri: string | undefined

      try {
        if (!(await Sharing.isAvailableAsync())) {
          toast.error(t('passageExport.sharingUnavailable'))
          return
        }
        const filename = `${safeFilename(result.reference) || 'bible-strong-export'}.txt`
        fileUri = `${FileSystem.cacheDirectory}${filename}`
        await FileSystem.writeAsStringAsync(fileUri, result.text, {
          encoding: FileSystem.EncodingType.UTF8,
        })
        await Sharing.shareAsync(fileUri, {
          dialogTitle: t('passageExport.title'),
          mimeType: 'text/plain',
          UTI: 'public.plain-text',
        })
      } catch {
        toast.error(t('passageExport.exportError'))
      } finally {
        if (fileUri) {
          try {
            await FileSystem.deleteAsync(fileUri, { idempotent: true })
          } catch {
            // Cache cleanup must not turn a successful share into an export error.
          }
        }
        setIsExporting(false)
      }
    }

    const footer = (props: SheetFooterProps) => (
      <SheetFooter {...props}>
        <Button
          onPress={exportFile}
          disabled={!hasContent || isPreparing}
          isLoading={isExporting}
          style={{ width: '100%' }}
        >
          {t('app.export')}
        </Button>
      </SheetFooter>
    )

    const previewCharacters = Array.from(result?.text || '')
    const preview =
      previewCharacters.length > PREVIEW_MAX_CHARACTERS
        ? `${previewCharacters.slice(0, PREVIEW_MAX_CHARACTERS).join('').trim()}\n…`
        : previewCharacters.join('')

    if (inline && inlineView)
      return (
        <Box>
          <TouchableBox className="p-3 flex-row items-center" onPress={() => setInlineView(null)}>
            <Text>{t('Retour')}</Text>
          </TouchableBox>
          {inlineView === 'scope'
            ? scopeOptions.map(option => (
                <TouchableBox
                  key={option.value}
                  className="p-3 flex-row items-center"
                  onPress={() => {
                    setResult(null)
                    setIsPreparing(true)
                    setScope(option.value)
                    setInlineView(null)
                  }}
                >
                  <Text>
                    {scope === option.value ? '✓ ' : ''}
                    {option.label}
                  </Text>
                </TouchableBox>
              ))
            : contentOptions.map(option => (
                <TouchableBox
                  key={option.key}
                  className="p-3 flex-row items-center"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: options[option.key] }}
                  onPress={() => toggleOption(option.key)}
                >
                  <Text>
                    {options[option.key] ? '☑ ' : '☐ '}
                    {option.label}
                  </Text>
                </TouchableBox>
              ))}
        </Box>
      )
    const Container = inline ? InlineExportContainer : Sheet
    return (
      <>
        <Container
          ref={sheetRef}
          snapPoints={[1]}
          backgroundColor={theme.colors.reverse}
          header={<SheetHeader title={t('passageExport.title')} />}
          footer={footer}
          onPresent={() => {
            setScope(initialScope)
            setIsPresented(true)
          }}
          onDismiss={() => {
            setIsPresented(false)
            setIsPreparing(false)
            setResult(null)
          }}
        >
          <SheetScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom, gap: 20 }}
          >
            <Box className="overflow-hidden border-continuous">
              <Box className="overflow-hidden border-continuous flex-row gap-[10px]">
                <ExportFilterButton
                  label={t('passageExport.scope')}
                  screen={{
                    title: t('passageExport.scope'),
                    content: navigation => (
                      <FilterChoices
                        options={scopeOptions.map(option => ({
                          key: option.value,
                          label: option.label,
                          selected: scope === option.value,
                          onSelect: () => {
                            setResult(null)
                            setIsPreparing(true)
                            setScope(option.value)
                            navigation.back()
                          },
                        }))}
                      />
                    ),
                  }}
                  value={scopeLabels[scope]}
                  onPress={() =>
                    inline ? setInlineView('scope') : scopeSheetRef.current?.present()
                  }
                />
                <ExportFilterButton
                  label={t('passageExport.content')}
                  screen={{
                    title: t('passageExport.content'),
                    content: () => (
                      <ExportContentChoices
                        choices={contentOptions}
                        initial={options}
                        onToggle={toggleOption}
                      />
                    ),
                  }}
                  value={contentSummary}
                  onPress={() =>
                    inline ? setInlineView('content') : contentSheetRef.current?.present()
                  }
                />
              </Box>
            </Box>

            <Box className="overflow-hidden border-continuous gap-[8px]">
              <Text className="font-bold text-[13px] text-grey">
                {t('passageExport.preview').toUpperCase()}
              </Text>
              {result && (
                <Text className="text-grey text-[12px]">
                  {t('passageExport.summary', result.counts)}
                </Text>
              )}
              {hasIncompleteSync && (
                <Box className="overflow-hidden border-continuous p-[12px] rounded-[12px] bg-light-grey">
                  <Text
                    className="text-grey text-[12px]"
                    style={{ flexDirection: 'column-reverse' }}
                  >
                    {t('passageExport.syncWarning')}
                  </Text>
                </Box>
              )}
              {result?.missingVerseTextKeys.length ? (
                <Box className="overflow-hidden border-continuous p-[12px] rounded-[12px] bg-light-grey">
                  <Text
                    className="text-grey text-[12px]"
                    style={{ flexDirection: 'column-reverse' }}
                  >
                    {t('passageExport.missingBibleText', {
                      count: result.missingVerseTextKeys.length,
                    })}
                  </Text>
                </Box>
              ) : null}
              {result?.hasSkippedInvalidData ? (
                <Box className="overflow-hidden border-continuous p-[12px] rounded-[12px] bg-light-grey">
                  <Text
                    className="text-grey text-[12px]"
                    style={{ flexDirection: 'column-reverse' }}
                  >
                    {t('passageExport.invalidDataSkipped')}
                  </Text>
                </Box>
              ) : null}
              <Box className="overflow-hidden border-continuous p-[16px] rounded-[14px] bg-light-grey">
                <Text
                  className="text-[13px] leading-[20px]"
                  selectable
                  style={{ flexDirection: 'column-reverse' }}
                >
                  {isPreparing
                    ? t('passageExport.preparing')
                    : hasContent
                      ? preview
                      : t('passageExport.empty')}
                </Text>
              </Box>
            </Box>
          </SheetScrollView>
        </Container>

        <ChoiceFilterModal
          ref={scopeSheetRef}
          title={t('passageExport.scope')}
          selectedValue={scope}
          options={scopeOptions}
          onSelect={nextScope => {
            setResult(null)
            if (isPresented) setIsPreparing(true)
            setScope(nextScope)
            scopeSheetRef.current?.dismiss()
          }}
        />

        <MultipleChoiceFilterModal
          ref={contentSheetRef}
          title={t('passageExport.content')}
          selectedValues={selectedContentValues}
          options={contentOptions.map(option => ({
            value: option.key,
            label: option.label,
          }))}
          onToggle={toggleOption}
        />
      </>
    )
  }
)

PassageExportSheet.displayName = 'PassageExportSheet'

const InlineExportContainer = ({
  children,
  footer: Footer,
}: import('~common/sheet').SheetProps & { ref?: React.Ref<SheetRef> }) => (
  <Box>
    {children}
    {Footer && <Footer />}
  </Box>
)

export default PassageExportSheet

function ExportContentChoices({
  choices,
  initial,
  onToggle,
}: {
  choices: { key: keyof PassageExportOptions; label: string }[]
  initial: PassageExportOptions
  onToggle: (key: keyof PassageExportOptions) => void
}) {
  const [selected, setSelected] = useState(initial)
  return (
    <FilterChoices
      showCheckbox
      options={choices.map(choice => ({
        key: choice.key,
        label: choice.label,
        selected: selected[choice.key],
        onSelect: () => {
          setSelected(current => ({ ...current, [choice.key]: !current[choice.key] }))
          onToggle(choice.key)
        },
      }))}
    />
  )
}
