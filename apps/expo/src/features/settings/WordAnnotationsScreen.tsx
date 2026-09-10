import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { FlatList } from 'react-native'
import { useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'

import { pageContentStyle } from '~common/ui/PageContent'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { useAtom, useSetAtom } from 'jotai/react'
import { sections } from '~assets/bible_versions/books-desc'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import ColorFilterModal from '~common/ColorFilterModal'
import FiltersHeader from '~common/FiltersHeader'
import type { SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import { getAnnotationGroupVerseKey } from '~features/entityListQuery/wordAnnotationsQuery'
import { getBibleViewParamsForVerseKeys } from '~features/studyRelations/openableStudyObjects'
import { isBookInTestament } from '~helpers/bibleBookCatalog'
import { useAllColors, useColorInfo } from '~helpers/useColorName'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { RootState } from '~redux/modules/reducer'
import { WordAnnotation } from '~redux/modules/user/wordAnnotations'
import { selectAvailableAnnotationVersions } from '~redux/selectors/bible'
import { unifiedTagsModalAtom } from '~state/app'
import {
  defaultWordAnnotationsListQueryState,
  shouldClearPersistedReferenceFilter,
  wordAnnotationsListQueryAtom,
} from '~state/entityListFilters'

const TabContainer = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'flex-row bg-reverse border-b-[1px] border-b-border px-[16px]',
    className
  )
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const Tab = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof { active: boolean } | 'theme'
  > &
    Omit<{ active: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { active } = props
  const resolvedClassName = twMerge('py-[12px] px-[16px] border-b-[2px]', className)
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={
        [
          { borderBottomColor: active ? theme.colors.primary : 'transparent' },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

const TabText = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.Text>,
    keyof { active: boolean } | 'theme'
  > &
    Omit<{ active: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { active } = props
  const resolvedClassName = twMerge('text-[14px]', className)
  return (
    <NativeUI.Text
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            fontWeight: active ? 'bold' : 'normal',
            color: active ? theme.colors.primary : theme.colors.tertiary,
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.Text>['style']
      }
    />
  )
}

const AnnotationCard = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'bg-reverse mx-[16px] my-[8px] p-[16px] rounded-[8px] border-[1px] border-border',
    className
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']}
    />
  )
}

const AnnotationText = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.Text>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-[16px] text-default mb-[8px]', className)
  return (
    <NativeUI.Text
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.Text>['style']}
    />
  )
}

const AnnotationMeta = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.Text>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-[13px] text-tertiary', className)
  return (
    <NativeUI.Text
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.Text>['style']}
    />
  )
}

const EmptyState = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-[1] justify-center items-center p-[32px]', className)
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const EmptyText = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.Text>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-[16px] text-tertiary text-center', className)
  return (
    <NativeUI.Text
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.Text>['style']}
    />
  )
}

const WordAnnotationsScreen = () => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const [queryState, setQueryState] = useAtom(wordAnnotationsListQueryAtom)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const colorModalRef = useRef<SheetRef>(null)
  const styleModalRef = useRef<SheetRef>(null)
  const versionModalRef = useRef<SheetRef>(null)
  const testamentModalRef = useRef<SheetRef>(null)
  const bookModalRef = useRef<SheetRef>(null)
  const sortModalRef = useRef<SheetRef>(null)

  // Get all annotations from Redux
  const annotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const tagsReady = useSelector((state: RootState) => !state.user.id || state.user.sync.loaded.tags)
  const annotationVersionsReady = useSelector(
    (state: RootState) => !state.user.id || state.user.sync.loaded.wordAnnotations
  )
  const versions = useSelector(selectAvailableAnnotationVersions)
  const selectedTag = queryState.tagId ? tags[queryState.tagId] : undefined
  const colorInfo = useColorInfo(queryState.colorId || undefined)
  const allColors = useAllColors()
  const webChoices = <T,>(
    choices: { value: T; label: string; color?: string }[],
    selected: T,
    onSelect: (value: T) => void
  ) =>
    NativeUI.Platform.OS === 'web'
      ? choices.map(choice => ({
          key: String(choice.value),
          label: choice.label,
          color: choice.color,
          selected: choice.value === selected,
          onSelect: () => onSelect(choice.value),
        }))
      : undefined
  const books = sections.flatMap(section => section.data)
  useEffect(() => {
    if (
      shouldClearPersistedReferenceFilter({
        hasReference: Boolean(queryState.tagId),
        referenceExists: Boolean(queryState.tagId && tags[queryState.tagId]),
        referenceDataReady: tagsReady,
      })
    ) {
      setQueryState(state => ({ ...state, tagId: null }))
    }
    if (
      shouldClearPersistedReferenceFilter({
        hasReference: Boolean(queryState.version),
        referenceExists: Boolean(queryState.version && versions.includes(queryState.version)),
        referenceDataReady: annotationVersionsReady,
      })
    ) {
      setQueryState(state => ({ ...state, version: null }))
    }
  }, [
    annotationVersionsReady,
    queryState.tagId,
    queryState.version,
    setQueryState,
    tags,
    tagsReady,
    versions,
  ])

  // Convert to array and sort
  const annotationsList = (() => {
    const list = Object.entries(annotations).map(([, annotation]) => ({
      ...annotation,
    }))
    const filtered = list.filter(annotation => {
      if (queryState.colorId && annotation.color !== queryState.colorId) return false
      if (queryState.tagId && !annotation.tags?.[queryState.tagId]) return false
      if (queryState.annotationType && annotation.type !== queryState.annotationType) return false
      if (queryState.version && annotation.version !== queryState.version) return false
      const booksInRanges = annotation.ranges.map(range => Number(range.verseKey.split('-')[0]))
      if (queryState.book && !booksInRanges.includes(queryState.book)) return false
      if (
        queryState.testament === 'old' &&
        !booksInRanges.some(book => isBookInTestament(book, 'old'))
      )
        return false
      if (
        queryState.testament === 'new' &&
        !booksInRanges.some(book => isBookInTestament(book, 'new'))
      )
        return false
      return true
    })
    return filtered.sort((left, right) => {
      if (queryState.sort === 'newest')
        return right.date - left.date || left.id.localeCompare(right.id)
      if (queryState.sort === 'oldest')
        return left.date - right.date || left.id.localeCompare(right.id)
      const leftKey = left.ranges
        .map(range => range.verseKey.split('-').map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])[0]
      const rightKey = right.ranges
        .map(range => range.verseKey.split('-').map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])[0]
      return (
        (leftKey?.[0] || 0) - (rightKey?.[0] || 0) ||
        (leftKey?.[1] || 0) - (rightKey?.[1] || 0) ||
        (leftKey?.[2] || 0) - (rightKey?.[2] || 0) ||
        left.id.localeCompare(right.id)
      )
    })
  })()

  // Group by verse
  const groupedByVerse = (() => {
    const groups = new Map<string, typeof annotationsList>()

    annotationsList.forEach(annotation => {
      const verseKey = getAnnotationGroupVerseKey(annotation, {
        book: queryState.book,
        testament: queryState.testament,
      })
      if (!verseKey) return

      if (!groups.has(verseKey)) {
        groups.set(verseKey, [])
      }
      groups.get(verseKey)!.push(annotation)
    })

    const compareVerseKeys = (left: string, right: string) => {
      const leftParts = left.split('-').map(Number)
      const rightParts = right.split('-').map(Number)
      return (
        leftParts[0] - rightParts[0] || leftParts[1] - rightParts[1] || leftParts[2] - rightParts[2]
      )
    }
    const compareDates = (
      left: (typeof annotationsList)[number],
      right: (typeof annotationsList)[number]
    ) =>
      (queryState.sort === 'oldest' ? left.date - right.date : right.date - left.date) ||
      left.id.localeCompare(right.id)

    return Array.from(groups.entries())
      .sort(([left], [right]) => compareVerseKeys(left, right))
      .map(([verseKey, groupedAnnotations]) => ({
        verseKey,
        reference: verseToReference({ [verseKey]: true }),
        annotations: groupedAnnotations.sort(compareDates),
      }))
  })()

  // Group by date
  const groupedByDate = (() => {
    const groups = new Map<string, typeof annotationsList>()

    annotationsList.forEach(annotation => {
      const date = new Date(annotation.date)
      const dateKey = date.toISOString().slice(0, 10)

      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey)!.push(annotation)
    })

    return Array.from(groups.entries())
      .sort(([left], [right]) =>
        queryState.sort === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)
      )
      .map(([date, groupedAnnotations]) => ({
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString(),
        annotations: groupedAnnotations.sort(
          (left, right) => left.date - right.date || left.id.localeCompare(right.id)
        ),
      }))
  })()

  // Handle annotation tap - navigate to Bible verse
  const handleAnnotationPress = (annotation: WordAnnotation & { id: string }) => {
    const firstRange = annotation.ranges[0]
    if (!firstRange) return

    pushRouteOnce({
      pathname: '/bible-view',
      params: getBibleViewParamsForVerseKeys(
        annotation.ranges.map(range => range.verseKey),
        annotation.version
      ),
    })
  }

  // Render annotation card
  const renderAnnotationCard = (annotation: WordAnnotation & { id: string }) => {
    // Combine all text from ranges
    const allText = annotation.ranges.map(r => r.text).join(' ... ')
    const reference = verseToReference(
      annotation.ranges.reduce((acc, r) => ({ ...acc, [r.verseKey]: true }), {})
    )

    return (
      <AnnotationCard key={annotation.id} onPress={() => handleAnnotationPress(annotation)}>
        <AnnotationText numberOfLines={3}>{allText}</AnnotationText>
        <AnnotationMeta>
          {reference} • {annotation.version}
          {annotation.noteId && ` • ${t('Contient une note')}`}
        </AnnotationMeta>
      </AnnotationCard>
    )
  }

  // Render content based on view mode
  const renderContent = () => {
    if (annotationsList.length === 0) {
      return (
        <EmptyState>
          <EmptyText>
            {Object.keys(annotations).length
              ? t('entityList.noFilterMatch')
              : t("Vous n'avez pas encore annoté de mots...")}
          </EmptyText>
        </EmptyState>
      )
    }

    if (queryState.view === 'verse') {
      return (
        <FlatList
          contentContainerStyle={pageContentStyle}
          data={groupedByVerse}
          keyExtractor={item => item.verseKey}
          renderItem={({ item }) => (
            <Box className="overflow-hidden border-continuous">
              <Box className="overflow-hidden border-continuous px-[16px] py-[8px]">
                <Text className="text-[14px] font-bold text-tertiary">{item.reference}</Text>
              </Box>
              {item.annotations.map(renderAnnotationCard)}
            </Box>
          )}
        />
      )
    }

    if (queryState.view === 'date') {
      return (
        <FlatList
          contentContainerStyle={pageContentStyle}
          data={groupedByDate}
          keyExtractor={item => item.date}
          renderItem={({ item }) => (
            <Box className="overflow-hidden border-continuous">
              <Box className="overflow-hidden border-continuous px-[16px] py-[8px]">
                <Text className="text-[14px] font-bold text-tertiary">{item.label}</Text>
              </Box>
              {item.annotations.map(renderAnnotationCard)}
            </Box>
          )}
        />
      )
    }

    // Flat list
    return (
      <FlatList
        contentContainerStyle={pageContentStyle}
        data={annotationsList}
        keyExtractor={item => item.id}
        renderItem={({ item }) => renderAnnotationCard(item)}
      />
    )
  }

  return (
    <Container className="bg-light-grey flex-[1]">
      <FiltersHeader
        title={t('Annotations')}
        hasBackButton
        onReset={() => setQueryState(defaultWordAnnotationsListQueryState)}
        filters={[
          {
            key: 'color',
            icon: 'droplet',
            label: t('Couleur'),
            value: colorInfo?.name || t('Toutes'),
            active: Boolean(queryState.colorId),
            onPress: () => colorModalRef.current?.present(),
            options: webChoices(
              [
                { value: '', label: t('Toutes') },
                ...allColors.map(color => ({
                  value: color.id,
                  label: color.name,
                  color: color.hex,
                })),
              ],
              queryState.colorId || '',
              colorId => setQueryState(state => ({ ...state, colorId: colorId || null }))
            ),
          },
          {
            key: 'tag',
            icon: 'tag',
            label: t('Tags'),
            value: selectedTag?.name || t('Tous'),
            active: Boolean(queryState.tagId),
            searchable: true,
            showCheckbox: true,
            options: webChoices(
              [
                { value: '', label: t('Tous') },
                ...Object.values(tags)
                  .filter(tag => tag?.id && tag?.name)
                  .map(tag => ({ value: tag.id, label: tag.name })),
              ],
              queryState.tagId || '',
              tagId => setQueryState(state => ({ ...state, tagId: tagId || null }))
            ),
            onPress: () =>
              setUnifiedTagsModal({
                mode: 'filter',
                selectedTag,
                onSelect: tag => setQueryState(state => ({ ...state, tagId: tag?.id || null })),
              }),
          },
          {
            key: 'style',
            icon: 'edit-3',
            label: t('Style'),
            value: queryState.annotationType || t('Tous'),
            active: Boolean(queryState.annotationType),
            onPress: () => styleModalRef.current?.present(),
            options: webChoices<typeof queryState.annotationType>(
              [
                { value: null, label: t('Tous') },
                { value: 'background', label: t('Arrière-plan') },
                { value: 'underline', label: t('Souligné') },
                { value: 'circle', label: t('Entouré') },
              ],
              queryState.annotationType,
              annotationType => setQueryState(state => ({ ...state, annotationType }))
            ),
          },
          {
            key: 'version',
            icon: 'book-open',
            label: t('Version'),
            value: queryState.version || t('Toutes'),
            active: Boolean(queryState.version),
            onPress: () => versionModalRef.current?.present(),
            searchable: true,
            options: webChoices(
              [
                { value: '', label: t('Toutes') },
                ...versions.map(value => ({ value, label: value })),
              ],
              queryState.version || '',
              version => setQueryState(state => ({ ...state, version: version || null }))
            ),
          },
          {
            key: 'testament',
            icon: 'book',
            label: t('Testament'),
            value:
              queryState.testament === 'all'
                ? t('Toute la Bible')
                : queryState.testament === 'old'
                  ? t('Ancien Testament')
                  : t('Nouveau Testament'),
            active: queryState.testament !== 'all',
            onPress: () => testamentModalRef.current?.present(),
            options: webChoices<typeof queryState.testament>(
              [
                { value: 'all', label: t('Toute la Bible') },
                { value: 'old', label: t('Ancien Testament') },
                { value: 'new', label: t('Nouveau Testament') },
              ],
              queryState.testament,
              testament =>
                setQueryState(state => ({
                  ...state,
                  testament,
                  book:
                    state.book && testament !== 'all' && !isBookInTestament(state.book, testament)
                      ? null
                      : state.book,
                }))
            ),
          },
          {
            key: 'book',
            icon: 'bookmark',
            label: t('Livre'),
            value: books.find(book => book.Numero === queryState.book)?.Nom || t('Tous'),
            active: Boolean(queryState.book),
            onPress: () => bookModalRef.current?.present(),
            searchable: true,
            options: webChoices(
              [
                { value: 0, label: t('Tous') },
                ...books
                  .filter(
                    book =>
                      queryState.testament === 'all' ||
                      isBookInTestament(book.Numero, queryState.testament)
                  )
                  .map(book => ({ value: book.Numero, label: book.Nom })),
              ],
              queryState.book || 0,
              book =>
                setQueryState(state => ({
                  ...state,
                  book: book || null,
                  testament: book
                    ? isBookInTestament(book, 'new')
                      ? 'new'
                      : 'old'
                    : state.testament,
                }))
            ),
          },
          {
            key: 'sort',
            icon: 'list',
            label: t('Ordre'),
            value:
              queryState.sort === 'bible'
                ? t('Ordre biblique')
                : queryState.sort === 'newest'
                  ? t('entityList.sort.newest')
                  : t('entityList.sort.oldest'),
            active: queryState.sort !== defaultWordAnnotationsListQueryState.sort,
            onPress: () => sortModalRef.current?.present(),
            options: webChoices<typeof queryState.sort>(
              [
                { value: 'bible', label: t('Ordre biblique') },
                { value: 'newest', label: t('entityList.sort.newest') },
                { value: 'oldest', label: t('entityList.sort.oldest') },
              ],
              queryState.sort,
              sort => setQueryState(state => ({ ...state, sort }))
            ),
          },
        ]}
      />
      <ColorFilterModal
        ref={colorModalRef}
        selectedColorId={queryState.colorId || undefined}
        onSelect={colorId => {
          setQueryState(state => ({ ...state, colorId: colorId || null }))
          colorModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={styleModalRef}
        title={t('Style')}
        selectedValue={queryState.annotationType || 'all'}
        options={[
          { value: 'all', label: t('Tous') },
          { value: 'background', label: t('Arrière-plan') },
          { value: 'underline', label: t('Souligné') },
          { value: 'circle', label: t('Entouré') },
        ]}
        onSelect={annotationType => {
          setQueryState(state => ({
            ...state,
            annotationType:
              annotationType === 'all' ? null : (annotationType as typeof state.annotationType),
          }))
          styleModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={versionModalRef}
        title={t('Version')}
        selectedValue={queryState.version || 'all'}
        options={[
          { value: 'all', label: t('Toutes') },
          ...versions.map(value => ({ value, label: value })),
        ]}
        onSelect={version => {
          setQueryState(state => ({ ...state, version: version === 'all' ? null : version }))
          versionModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={testamentModalRef}
        title={t('Testament')}
        selectedValue={queryState.testament}
        options={[
          { value: 'all', label: t('Toute la Bible') },
          { value: 'old', label: t('Ancien Testament') },
          { value: 'new', label: t('Nouveau Testament') },
        ]}
        onSelect={testament => {
          setQueryState(state => ({
            ...state,
            testament,
            book:
              state.book &&
              ((testament === 'old' && !isBookInTestament(state.book, 'old')) ||
                (testament === 'new' && !isBookInTestament(state.book, 'new')))
                ? null
                : state.book,
          }))
          testamentModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={bookModalRef}
        title={t('Livre')}
        selectedValue={String(queryState.book || 0)}
        options={[
          { value: '0', label: t('Tous') },
          ...books
            .filter(
              book =>
                queryState.testament === 'all' ||
                isBookInTestament(book.Numero, queryState.testament)
            )
            .map(book => ({ value: String(book.Numero), label: book.Nom })),
        ]}
        onSelect={book => {
          const number = Number(book) || null
          setQueryState(state => ({
            ...state,
            book: number,
            testament: number
              ? isBookInTestament(number, 'new')
                ? 'new'
                : 'old'
              : state.testament,
          }))
          bookModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={sortModalRef}
        title={t('Ordre')}
        selectedValue={queryState.sort}
        options={[
          { value: 'bible', label: t('Ordre biblique') },
          { value: 'newest', label: t('entityList.sort.newest') },
          { value: 'oldest', label: t('entityList.sort.oldest') },
        ]}
        onSelect={sort => {
          setQueryState(state => ({ ...state, sort }))
          sortModalRef.current?.dismiss()
        }}
      />

      <TabContainer>
        <Tab
          active={queryState.view === 'verse'}
          onPress={() => setQueryState(state => ({ ...state, view: 'verse' }))}
        >
          <TabText active={queryState.view === 'verse'}>{t('Par verset')}</TabText>
        </Tab>
        <Tab
          active={queryState.view === 'date'}
          onPress={() => setQueryState(state => ({ ...state, view: 'date' }))}
        >
          <TabText active={queryState.view === 'date'}>{t('Par date')}</TabText>
        </Tab>
        <Tab
          active={queryState.view === 'flat'}
          onPress={() => setQueryState(state => ({ ...state, view: 'flat' }))}
        >
          <TabText active={queryState.view === 'flat'}>{t('Liste')}</TabText>
        </Tab>
      </TabContainer>

      {renderContent()}
    </Container>
  )
}

export default WordAnnotationsScreen
