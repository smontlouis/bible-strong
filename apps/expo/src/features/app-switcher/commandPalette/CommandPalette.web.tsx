import { resolveUniverseColors } from '~themes/universeColors'
import { parseBibleReferenceInput } from '~helpers/bcvParser'
import { paletteScopes, isPassageScope, createScopedPassageTab, type PaletteScope } from './scopes'
import PlanSuggestions from './PlanSuggestions.web'
import { getReferenceSearchItemsFromSegments } from '~features/search/shared/searchItems'
import ContentSuggestions from './ContentSuggestions.web'
import { getTabForSearchResult } from './searchResultTab'
import { createPreviewSearchFilters } from '~features/search/searchPreview'
import { useOpenStudyObject } from '~features/studyRelations/useOpenStudyObject'
import type { SearchItemType } from '~state/searchFilters'
import { recentCommandTabIdsAtom } from './state'
import './command-palette.css'
import { Command } from 'cmdk'
import { useRouter } from 'expo-router'
import { useAtomValue, useStore } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'
import { useSwitchGroup } from '~state/tabGroups'
import { getDefaultBibleTab, getDefaultData, tabGroupsAtom, type TabItem } from '~state/tabs'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { resolveThemeColor } from '~themes/colorValues'
import TabIcon, { tabIconColorConfig } from '../utils/getIconByTabType'
import { useOpenInNewTab } from '../utils/useOpenInNewTab'
import { useSlideNewTab } from '../utils/useSlideNewTab'
import { useSelectBibleReference } from '../TabScreen/NewTab/SelectBibleReferenceModalProvider'
import { destinations, findTabs, matchesQuery } from './results'

function PaletteItemLabel({ type, children }: { type: TabItem['type']; children: ReactNode }) {
  const theme = useTheme()
  const color = resolveThemeColor(theme, tabIconColorConfig[type] || 'grey')
  return (
    <span className="bs-command-item-label">
      <span
        className="bs-command-item-icon"
        aria-hidden="true"
        style={{
          backgroundColor: resolveUniverseColors(theme.colors, type).background,
        }}
      >
        <TabIcon type={type} size={16} color={color} />
      </span>
      <span className="bs-command-item-text">{children}</span>
    </span>
  )
}

export interface PaletteProps {
  tabAtom?: PrimitiveAtom<TabItem>
  onPlanPress?: () => void
  onDone?: () => void
  inputId?: string
}

export default function CommandPalette({ tabAtom, onPlanPress, onDone, inputId }: PaletteProps) {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const router = useRouter()
  const openStudyObject = useOpenStudyObject()
  const groups = useAtomValue(tabGroupsAtom)
  const recentIds = useAtomValue(recentCommandTabIdsAtom)
  const store = useStore()
  const switchGroup = useSwitchGroup()
  const { triggerSlideNewTab } = useSlideNewTab()
  const openInNewTab = useOpenInNewTab()
  const defaultVersion = useDefaultBibleVersion()
  const { openBibleReferenceModal } = useSelectBibleReference()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<PaletteScope>()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectScope = (next: PaletteScope) => {
    setScope(next)
    setQuery('')
    inputRef.current?.focus()
  }
  const removeScope = () => {
    setScope(undefined)
    inputRef.current?.focus()
  }
  const [focused, setFocused] = useState(false)
  const showSuggestions = Boolean(onDone) || !tabAtom || focused
  const referenceInput = parseBibleReferenceInput(
    query,
    i18n.language.startsWith('fr') ? 'fr' : 'en'
  )
  const passages = referenceInput.isExact ? referenceInput.references : []
  const tabs = findTabs(groups, query, recentIds)
  const actions = destinations.filter(item => matchesQuery(query, t(item.key), item.aliases))
  const matchingScopes = paletteScopes.filter(candidate =>
    actions.some(action => action.type === candidate.type)
  )
  const scopedPassages =
    isPassageScope(scope) && referenceInput.isExact
      ? getReferenceSearchItemsFromSegments(referenceInput.segments)
      : []
  const openTab = (tab: TabItem) => {
    if (tabAtom) {
      const previous = store.get(tabAtom)
      if (previous.type !== 'new') return
      store.set(tabAtom, { ...tab, id: previous.id })
    } else openInNewTab(tab, { autoRedirect: true })
    onDone?.()
  }
  const openSearch = (source?: SearchItemType) =>
    openTab({
      id: generateUUID(),
      type: 'search',
      isRemovable: true,
      title: query.trim(),
      data: {
        searchValue: query.trim(),
        filters: createPreviewSearchFilters(defaultVersion, source),
      },
    })
  const create = (type: (typeof destinations)[number]['type']) => {
    if (type === 'plan') {
      onDone?.()
      if (onPlanPress) onPlanPress()
      return
    }
    if (type === 'compare') {
      onDone?.()
      openBibleReferenceModal({
        onSelect: data =>
          openTab({
            id: generateUUID(),
            title: t('tabs.compare'),
            isRemovable: true,
            type: 'compare',
            data: {
              selectedVerses: {
                [`${data.selectedBook.Numero}-${data.selectedChapter}-${data.selectedVerse}`]: true,
              },
            },
          }),
      })
      return
    }
    if (type === 'bible') openTab(getDefaultBibleTab(defaultVersion))
    else
      openTab({
        id: generateUUID(),
        isRemovable: true,
        type,
        title: t(`tabs.${type}`),
        ...getDefaultData(type),
      } as TabItem)
  }
  return (
    <Command
      id={inputId}
      className="bs-command"
      shouldFilter={false}
      loop
      label={t('commandPalette.label')}
      style={
        {
          '--command-bg': theme.colors.reverse,
          '--command-text': theme.colors.default,
          '--command-muted': theme.colors.tertiary,
          '--command-border': theme.colors.border,
          '--command-active': theme.colors.lightPrimary,
          '--command-primary': theme.colors.primary,
          fontFamily: resolveFontFamily(theme.fontFamily.text),
        } as CSSProperties
      }
    >
      <div className="bs-command-input-row">
        <span aria-hidden="true">⌕</span>
        {scope && (
          <button
            type="button"
            className="bs-command-scope"
            aria-label={t('commandPalette.removeScope', { scope: t(scope.key) })}
            onMouseDown={event => event.preventDefault()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
            }}
            onClick={removeScope}
          >
            <TabIcon type={scope.type} size={14} />
            <span>{t(scope.key)}</span>
            <span aria-hidden="true">×</span>
          </button>
        )}
        <Command.Input
          ref={inputRef}
          onKeyDown={event => {
            if (event.key === 'Backspace' && !event.nativeEvent.isComposing && !query && scope) {
              event.preventDefault()
              removeScope()
            }
          }}
          asChild
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={Boolean(onDone) || !tabAtom}
          value={query}
          onValueChange={setQuery}
          placeholder={
            scope
              ? t(
                  isPassageScope(scope)
                    ? 'commandPalette.passagePlaceholder'
                    : 'commandPalette.scopedPlaceholder',
                  { scope: t(scope.key) }
                )
              : t('commandPalette.placeholder')
          }
          aria-label={t('commandPalette.label')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        >
          <input aria-expanded={showSuggestions} />
        </Command.Input>
        <kbd>
          {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
            ? '⌘ K'
            : 'Ctrl K'}
        </kbd>
      </div>
      <Command.List
        hidden={!showSuggestions}
        onMouseDown={event => {
          // Keep input focus until the clicked suggestion has been selected.
          if (event.button === 0) event.preventDefault()
        }}
      >
        {!scope && query.trim() && matchingScopes.length > 0 && (
          <Command.Group heading={t('commandPalette.scopeHeading')}>
            {matchingScopes.map(candidate => (
              <Command.Item
                key={candidate.type}
                value={`scope:${candidate.type}`}
                onSelect={() => selectScope(candidate)}
              >
                <PaletteItemLabel type={candidate.type}>
                  {t(
                    candidate.type === 'compare'
                      ? 'commandPalette.compareScope'
                      : 'commandPalette.searchIn',
                    { scope: t(candidate.key) }
                  )}
                </PaletteItemLabel>
                <small>↵</small>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {isPassageScope(scope) && (
          <Command.Group heading={t(scope.key)}>
            {scopedPassages.map(passage => (
              <Command.Item
                key={passage.id}
                value={`scoped-passage:${passage.id}`}
                onSelect={() => {
                  const tab = createScopedPassageTab(scope.type, passage, defaultVersion)
                  if (tab) openTab(tab)
                }}
              >
                <PaletteItemLabel type={scope.type}>
                  {t(
                    scope.type === 'compare'
                      ? 'commandPalette.comparePassage'
                      : scope.type === 'commentary'
                        ? 'commandPalette.commentPassage'
                        : 'commandPalette.open',
                    { title: passage.title }
                  )}
                </PaletteItemLabel>
              </Command.Item>
            ))}
            {!scopedPassages.length && (
              <div className="bs-command-status">{t('commandPalette.passagePlaceholder')}</div>
            )}
          </Command.Group>
        )}
        {!scope && passages.length > 0 && (
          <Command.Group heading={t('commandPalette.passages')}>
            {passages.map(passage => (
              <Command.Item
                key={passage.target.osis}
                value={`passage:${passage.target.osis}`}
                onSelect={() => {
                  const book = getBook(passage.target.book)
                  if (!book) return
                  const tab = getDefaultBibleTab(defaultVersion)
                  const selection = {
                    selectedBook: book,
                    selectedChapter: passage.target.chapter,
                    selectedVerse: passage.target.verse,
                  }
                  openTab({
                    ...tab,
                    title: passage.text,
                    data: {
                      ...tab.data,
                      ...selection,
                      temp: selection,
                      focusVerses: passage.target.focusVerses,
                    },
                  })
                }}
              >
                <PaletteItemLabel type="bible">
                  {t('commandPalette.open', { title: passage.text })}
                </PaletteItemLabel>
                <small>{defaultVersion}</small>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {!scope && tabs.length > 0 && (
          <Command.Group
            heading={t(query.trim() ? 'commandPalette.tabs' : 'commandPalette.recentTabs')}
          >
            {tabs.map(item => (
              <Command.Item
                key={item.tab.id}
                value={`tab:${item.tab.id}`}
                onSelect={() => {
                  onDone?.()
                  switchGroup(item.groupId)
                  router.dismissTo('/')
                  triggerSlideNewTab(item.tab.id)
                }}
              >
                <PaletteItemLabel type={item.tab.type}>{item.tab.title}</PaletteItemLabel>
                <small className="bs-command-group">
                  {!item.isDefaultGroup && (
                    <span
                      className="bs-command-group-dot"
                      aria-hidden="true"
                      style={{
                        backgroundColor: resolveThemeColor(theme, item.groupColor || '#64748b'),
                      }}
                    />
                  )}
                  <span className="bs-command-group-name">
                    {item.isDefaultGroup ? t('Principal') : item.groupName}
                  </span>
                </small>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {!scope && actions.length > 0 && (
          <Command.Group heading={t('commandPalette.create')}>
            {actions.map(item => (
              <Command.Item
                key={item.type}
                value={`create:${item.type}`}
                onSelect={() => create(item.type)}
              >
                <PaletteItemLabel type={item.type}>{t(item.key)}</PaletteItemLabel>
                <small>＋</small>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {showSuggestions && scope?.type === 'plan' && (
          <PlanSuggestions query={query} onSelect={openTab} />
        )}
        {showSuggestions && ((!scope && query.trim().length >= 2) || scope?.source) && (
          <ContentSuggestions
            key={scope?.type || 'all'}
            source={scope?.source}
            query={query}
            version={defaultVersion}
            onSeeAll={openSearch}
            onSelect={item => {
              const tab = getTabForSearchResult(item, defaultVersion)
              if (tab) openTab(tab)
              else {
                onDone?.()
                openStudyObject(item)
              }
            }}
          />
        )}
        {!scope && query.trim() && (
          <Command.Group heading={t('Rechercher')}>
            <Command.Item value="search:free" onSelect={() => openSearch()}>
              <PaletteItemLabel type="search">
                {t('commandPalette.search', { query: query.trim() })}
              </PaletteItemLabel>
              <small>↵</small>
            </Command.Item>
          </Command.Group>
        )}
      </Command.List>
      {showSuggestions && (
        <div className="bs-command-footer">
          {t(onDone || !tabAtom ? 'commandPalette.keyboard' : 'commandPalette.keyboardInline')}
        </div>
      )}
    </Command>
  )
}
