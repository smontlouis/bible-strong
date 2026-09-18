import ShortcutGuide from './ShortcutGuide.web'
import TabActionResults from './TabActionResults.web'
import { FeatherIcon } from '~common/ui/Icon'
import { tabContentKey } from './priorities'
import { useCreateDiscoveryDocument } from '~features/search/discovery/useCreateDiscoveryDocument'
import { resolveUniverseColors } from '~themes/universeColors'
import { parseBibleReferenceInput } from '~helpers/bcvParser'
import { paletteScopes, isPassageScope, type PaletteScope } from './scopes'
import CatalogSuggestions from './CatalogSuggestions.web'
import PassageSuggestions from './PassageSuggestions.web'
import { getReferenceSearchItemsFromSegments } from '~features/search/shared/searchItems'
import ContentSuggestions from './ContentSuggestions.web'
import { getTabForSearchResult } from './searchResultTab'
import { createPreviewSearchFilters } from '~features/search/searchPreview'
import { useOpenStudyObject } from '~features/studyRelations/useOpenStudyObject'
import type { SearchItemType } from '~state/searchFilters'
import { recentCommandTabIdsAtom, TAB_ACTIONS_SCOPE } from './state'
import './command-palette.css'
import { Command } from 'cmdk'
import { useRouter } from 'expo-router'
import { useAtomValue, useStore } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import generateUUID from '~helpers/generateUUID'
import { useSwitchGroup } from '~state/tabGroups'
import { tabGroupsAtom, type TabItem } from '~state/tabs'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { resolveThemeColor } from '~themes/colorValues'
import TabIcon, { tabIconColorConfig } from '../utils/getIconByTabType'
import { useOpenInNewTab } from '../utils/useOpenInNewTab'
import { useSlideNewTab } from '../utils/useSlideNewTab'

import { destinations, findTabs, matchesQuery } from './results'

function PaletteItemLabel({
  type,
  children,
  creation = false,
}: {
  type: TabItem['type']
  children: ReactNode
  creation?: boolean
}) {
  const theme = useTheme()
  const colorType = creation ? 'study' : type
  const color = resolveThemeColor(theme, tabIconColorConfig[colorType] || 'grey')
  return (
    <span className="bs-command-item-label">
      <span
        className="bs-command-item-icon"
        aria-hidden="true"
        style={{
          backgroundColor: resolveUniverseColors(theme.colors, colorType).background,
        }}
      >
        {creation ? (
          <FeatherIcon name="plus" size={16} color={color} />
        ) : (
          <TabIcon type={type} size={16} color={color} />
        )}
      </span>
      <span className="bs-command-item-text">{children}</span>
    </span>
  )
}

export interface PaletteProps {
  tabAtom?: PrimitiveAtom<TabItem>
  onDone?: () => void
  initialScope?: string
  inputId?: string
}

export default function CommandPalette({ tabAtom, onDone, inputId, initialScope }: PaletteProps) {
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
  const [query, setQuery] = useState('')
  const [actionMode, setActionMode] = useState(initialScope === TAB_ACTIONS_SCOPE)
  const [scope, setScope] = useState<PaletteScope | undefined>(() =>
    paletteScopes.find(item => item.type === initialScope)
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const selectScope = (next: PaletteScope) => {
    setActionMode(false)
    setScope(next)
    setQuery('')
    inputRef.current?.focus()
  }
  const removeScope = () => {
    setActionMode(false)
    setScope(undefined)
    inputRef.current?.focus()
  }
  const [focused, setFocused] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const showSuggestions = Boolean(onDone) || !tabAtom || focused || helpOpen
  const referenceInput = parseBibleReferenceInput(
    query,
    i18n.language.startsWith('fr') ? 'fr' : 'en'
  )
  const [tabLimit, setTabLimit] = useState(3)
  const tabs = findTabs(groups, query, recentIds)
  const visibleTabs = tabs.slice(0, tabLimit)
  const excludedKeys = visibleTabs.flatMap(({ tab }) => {
    const key = tabContentKey(tab)
    return key ? [key] : []
  })
  const actions = destinations.filter(item => matchesQuery(query, t(item.key), item.aliases))
  const matchingScopes = paletteScopes.filter(candidate =>
    actions.some(action => action.type === candidate.type)
  )
  const scopedPassages = referenceInput.isExact
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
  const documents = useCreateDiscoveryDocument(openTab, onDone)
  const openSearch = (source?: SearchItemType) =>
    openTab({
      id: generateUUID(),
      type: 'search',
      isRemovable: true,
      title: query.trim(),
      data: {
        searchValue: query.trim(),
        filters: {
          ...createPreviewSearchFilters(defaultVersion, source),
          openResultsInNewTabs: true,
        },
      },
    })
  const chooseCategory = (type: (typeof destinations)[number]['type']) => {
    const next = paletteScopes.find(candidate => candidate.type === type)
    if (next) {
      selectScope(next)
    }
  }
  return (
    <Command
      id={inputId}
      className="bs-command"
      shouldFilter={false}
      loop
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      label={t('commandPalette.label')}
      style={
        {
          '--command-bg': theme.colors.reverse,
          '--command-text': theme.colors.default,
          '--command-muted': theme.colors.tertiary,
          '--command-border': theme.colors.border,
          '--command-active': theme.colors.lightPrimary,
          '--command-primary': theme.colors.primary,
          '--command-danger': theme.colors.quart,
          fontFamily: resolveFontFamily(theme.fontFamily.text),
        } as CSSProperties
      }
    >
      <div className="bs-command-input-row">
        <span aria-hidden="true">⌕</span>
        {(scope || actionMode) && (
          <button
            type="button"
            className="bs-command-scope"
            style={{
              backgroundColor: actionMode
                ? theme.colors.lightPrimary
                : resolveUniverseColors(theme.colors, scope!.type).background,
            }}
            aria-label={t('commandPalette.removeScope', {
              scope: t(actionMode ? 'hotkeys.tabActions' : scope!.key),
            })}
            onMouseDown={event => event.preventDefault()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
            }}
            onClick={removeScope}
          >
            {actionMode ? (
              <FeatherIcon name="sliders" size={14} color={theme.colors.primary} />
            ) : (
              <TabIcon type={scope!.type} size={14} />
            )}
            <span
              style={{
                color: actionMode
                  ? theme.colors.primary
                  : resolveUniverseColors(theme.colors, scope!.type).foreground,
              }}
            >
              {t(actionMode ? 'hotkeys.tabActions' : scope!.key)}
            </span>
            <span aria-hidden="true">×</span>
          </button>
        )}
        <Command.Input
          ref={inputRef}
          onKeyDown={event => {
            if (
              event.key === 'Backspace' &&
              !event.nativeEvent.isComposing &&
              !query &&
              (scope || actionMode)
            ) {
              event.preventDefault()
              removeScope()
            }
          }}
          asChild
          autoFocus={Boolean(onDone) || !tabAtom}
          value={query}
          onValueChange={value => {
            if (!actionMode && value.trimStart().startsWith('>')) {
              setActionMode(true)
              setScope(undefined)
              setQuery(value.trimStart().slice(1).trimStart())
            } else setQuery(value)
            setTabLimit(3)
          }}
          placeholder={
            actionMode
              ? t('hotkeys.filterActions')
              : scope
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
            ? actionMode
              ? '⌘ ⇧ K'
              : '⌘ K'
            : actionMode
              ? 'Ctrl Shift K'
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
        {actionMode ? (
          <TabActionResults query={query.trim()} onDone={onDone} />
        ) : (
          <>
            {!scope && query.trim() && matchingScopes.length > 0 && (
              <Command.Group heading={t('commandPalette.scopeHeading')}>
                {matchingScopes.map(candidate => (
                  <Command.Item
                    key={candidate.type}
                    value={`scope:${candidate.type}`}
                    onSelect={() => selectScope(candidate)}
                  >
                    <PaletteItemLabel type={candidate.type}>
                      {t('commandPalette.searchIn', { scope: t(candidate.key) })}
                    </PaletteItemLabel>
                    <small>↵</small>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {(!scope || isPassageScope(scope)) && scopedPassages.length > 0 && (
              <PassageSuggestions
                items={scopedPassages}
                version={defaultVersion}
                compare={scope?.type === 'compare'}
                onSelect={openTab}
              />
            )}
            {isPassageScope(scope) && !scopedPassages.length && (
              <div className="bs-command-status">{t('commandPalette.passagePlaceholder')}</div>
            )}
            {!scope && tabs.length > 0 && (
              <Command.Group
                heading={t(query.trim() ? 'commandPalette.tabs' : 'commandPalette.recentTabs')}
              >
                {visibleTabs.map(item => (
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
                {tabs.length > tabLimit && (
                  <Command.Item value="tabs:more" onSelect={() => setTabLimit(value => value + 3)}>
                    {t('Voir plus')}
                  </Command.Item>
                )}
              </Command.Group>
            )}
            {!scope && actions.length > 0 && (!query.trim() || !matchingScopes.length) && (
              <Command.Group heading={t('commandPalette.scopeHeading')}>
                {actions.map(item => (
                  <Command.Item
                    key={item.type}
                    value={`category:${item.type}`}
                    onSelect={() => chooseCategory(item.type)}
                  >
                    <PaletteItemLabel type={item.type}>
                      {t(item.type === 'bible' ? 'Passage' : item.key)}
                    </PaletteItemLabel>
                    <small>↵</small>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {(scope?.type === 'notes' || (scope?.type === 'study' && documents.canCreateStudy)) && (
              <Command.Group>
                <Command.Item
                  value="document:create"
                  onSelect={scope.type === 'notes' ? documents.createNote : documents.createStudy}
                >
                  <PaletteItemLabel type={scope.type} creation>
                    {t(scope.type === 'notes' ? 'accessibility.newNote' : 'accessibility.newStudy')}
                  </PaletteItemLabel>
                </Command.Item>
              </Command.Group>
            )}
            {showSuggestions && ((!scope && query.trim().length >= 2) || scope?.source) && (
              <ContentSuggestions
                key={scope?.type || 'all'}
                excludedKeys={scope ? [] : excludedKeys}
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
            {showSuggestions &&
              ((!scope && query.trim().length >= 2) ||
                scope?.type === 'plan' ||
                scope?.type === 'commentary' ||
                scope?.type === 'timeline') && (
                <CatalogSuggestions
                  key={`${scope?.type || 'all'}:${query}`}
                  query={query}
                  excludedKeys={scope ? [] : excludedKeys}
                  scope={
                    scope?.type === 'plan' ||
                    scope?.type === 'commentary' ||
                    scope?.type === 'timeline'
                      ? scope.type
                      : undefined
                  }
                  onSelect={openTab}
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
          </>
        )}
      </Command.List>
      {showSuggestions && (
        <div className="bs-command-footer">
          <span>
            {t(onDone || !tabAtom ? 'commandPalette.keyboard' : 'commandPalette.keyboardInline')}
          </span>
          <ShortcutGuide open={helpOpen} onOpenChange={setHelpOpen} />
        </div>
      )}
    </Command>
  )
}
