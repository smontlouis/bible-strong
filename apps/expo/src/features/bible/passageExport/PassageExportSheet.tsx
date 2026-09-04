import { useTheme } from '@emotion/react'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import MultipleChoiceFilterModal from '~common/MultipleChoiceFilterModal'
import {
  Sheet,
  SheetFooter,
  SheetHeader,
  SheetScrollView,
  type SheetFooterProps,
  type SheetRef,
} from '~common/sheet'
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
  version: VersionCode
}

const ALL_EXPORT_SCOPES = ['selection', 'chapter', 'book'] as const
const CHAPTER_EXPORT_SCOPES = ['chapter', 'book'] as const
const PREPARE_DEBOUNCE_MS = 150
const PREPARE_TIMEOUT_MS = 15_000
const PREVIEW_MAX_CHARACTERS = 1600

type ExportFilterButtonProps = {
  label: string
  value: string
  onPress: () => void
}

const ExportFilterButton = ({ label, value, onPress }: ExportFilterButtonProps) => (
  <TouchableBox
    accessibilityRole="button"
    accessibilityLabel={`${label}, ${value}`}
    onPress={onPress}
    flex={1}
    minWidth={0}
    p={13}
    borderWidth={1}
    borderColor="border"
    borderRadius={14}
  >
    <Text bold fontSize={11} color="grey" numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Box row alignItems="center" mt={5} gap={6}>
      <Text flex bold fontSize={14} numberOfLines={1}>
        {value}
      </Text>
      <FeatherIcon name="chevron-down" size={16} color="grey" />
    </Box>
  </TouchableBox>
)

const safeFilename = (reference: string) =>
  reference
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

const PassageExportSheet = forwardRef<SheetRef, PassageExportSheetProps>(
  ({ selectedVerses, bookNumber, chapterNumber, sourceType, version }, ref) => {
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
    const [isPresented, setIsPresented] = useState(false)
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

    return (
      <>
        <Sheet
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
            <Box>
              <Box row gap={10}>
                <ExportFilterButton
                  label={t('passageExport.scope')}
                  value={scopeLabels[scope]}
                  onPress={() => scopeSheetRef.current?.present()}
                />
                <ExportFilterButton
                  label={t('passageExport.content')}
                  value={contentSummary}
                  onPress={() => contentSheetRef.current?.present()}
                />
              </Box>
            </Box>

            <Box gap={8}>
              <Text bold fontSize={13} color="grey">
                {t('passageExport.preview').toUpperCase()}
              </Text>
              {result && (
                <Text color="grey" fontSize={12}>
                  {t('passageExport.summary', result.counts)}
                </Text>
              )}
              {hasIncompleteSync && (
                <Box p={12} borderRadius={12} bg="lightGrey">
                  <Text color="grey" fontSize={12} reverse>
                    {t('passageExport.syncWarning')}
                  </Text>
                </Box>
              )}
              {result?.missingVerseTextKeys.length ? (
                <Box p={12} borderRadius={12} bg="lightGrey">
                  <Text color="grey" fontSize={12} reverse>
                    {t('passageExport.missingBibleText', {
                      count: result.missingVerseTextKeys.length,
                    })}
                  </Text>
                </Box>
              ) : null}
              {result?.hasSkippedInvalidData ? (
                <Box p={12} borderRadius={12} bg="lightGrey">
                  <Text color="grey" fontSize={12} reverse>
                    {t('passageExport.invalidDataSkipped')}
                  </Text>
                </Box>
              ) : null}
              <Box p={16} borderRadius={14} bg="lightGrey">
                <Text selectable fontSize={13} lineHeight={20} reverse>
                  {isPreparing
                    ? t('passageExport.preparing')
                    : hasContent
                      ? preview
                      : t('passageExport.empty')}
                </Text>
              </Box>
            </Box>
          </SheetScrollView>
        </Sheet>

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

export default PassageExportSheet
