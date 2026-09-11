import { useTranslation } from 'react-i18next'
import ContextualMenu from '~common/ContextualPanel/ContextualMenu'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import { versions } from '~helpers/bibleVersions'
import { useVersionCatalog, VersionCatalogList } from '~features/bible/VersionCatalogView'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import ParamsModal from './ParamsModal'
import BibleFontList from '~features/bible/BibleFontList'
import type { PlanSliceMenuProps } from './PlanSliceMenu'

export default function PlanSliceMenu(props: PlanSliceMenuProps) {
  const { t } = useTranslation()
  const catalog = useVersionCatalog(Object.values(versions).filter(version => !version.hidden))
  return (
    <>
      <ContextualMenu
        {...props}
        panelWidth={500}
        panelTitle={t('Options')}
        onPanelClose={catalog.resetSearch}
        icons={{
          version: 'book-open',
          format: 'type',
          'mark-read': 'check',
          share: 'share',
          'open-tab': 'external-link',
        }}
        screens={{
          format: {
            title: t('Mise en forme'),
            width: 430,
            content: nav => <ParamsModal inline onFonts={() => nav.open('fonts')} />,
          },
          fonts: { title: t('Polices'), content: nav => <BibleFontList onSelect={nav.back} /> },
          version: {
            title: t('Changer de version'),
            headerRight: (
              <FiltersHeader
                buttonOnly
                title=""
                {...catalog.headerProps}
                filters={catalog.headerProps.filters.filter(filter => filter.key !== 'search')}
              />
            ),
            headerContent: <PanelSearch value={catalog.query} onChange={catalog.setQuery} />,
            content: navigation => (
              <VersionCatalogList
                sections={catalog.sections}
                grouping={catalog.grouping}
                query={catalog.query}
                openStyleInfo={catalog.openStyleInfo}
                bottomInset={0}
                revealVersionId={props.version}
                revealKey={0}
                scrollToTopKey={catalog.filterKey}
                renderItem={({ item }) => (
                  <VersionSelectorItem
                    version={item}
                    isSelected={item.id === props.version}
                    showStrongIndex
                    onChange={version => {
                      props.onVersionChange(version)
                      navigation.back()
                    }}
                  />
                )}
              />
            ),
          },
        }}
      />
      {catalog.modals}
    </>
  )
}
