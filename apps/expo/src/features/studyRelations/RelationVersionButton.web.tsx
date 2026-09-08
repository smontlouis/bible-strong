import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelNavigationContext } from '~common/ContextualPanel/NavigationContext'
import HeaderAction from '~common/ContextualPanel/HeaderAction'
import HeaderContent from '~common/ContextualPanel/HeaderContent'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import { TouchableBox } from '~common/ui/Box'
import { versions } from '~helpers/bibleVersions'
import { useVersionCatalog, VersionCatalogList } from '~features/bible/VersionCatalogView'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import type { RelationVersionButtonProps } from './RelationVersionButton'

function VersionChoices({
  version,
  onVersionChange,
}: Pick<RelationVersionButtonProps, 'version' | 'onVersionChange'>) {
  const catalog = useVersionCatalog(Object.values(versions).filter(version => !version.hidden))
  const navigation = useContext(PanelNavigationContext)
  return (
    <>
      <HeaderAction>
        <FiltersHeader
          buttonOnly
          title=""
          {...catalog.headerProps}
          filters={catalog.headerProps.filters.filter(filter => filter.key !== 'search')}
        />
      </HeaderAction>
      <HeaderContent>
        <PanelSearch value={catalog.query} onChange={catalog.setQuery} />
      </HeaderContent>
      <VersionCatalogList
        sections={catalog.sections}
        grouping={catalog.grouping}
        query={catalog.query}
        openStyleInfo={catalog.openStyleInfo}
        bottomInset={0}
        scrollToTopKey={catalog.filterKey}
        revealVersionId={version}
        renderItem={({ item }) => (
          <VersionSelectorItem
            version={item}
            isSelected={item.id === version}
            onChange={value => {
              onVersionChange(value)
              navigation?.back()
            }}
          />
        )}
      />
    </>
  )
}
export default function RelationVersionButton({
  version,
  onVersionChange,
  onPress,
  ...props
}: RelationVersionButtonProps) {
  const { t } = useTranslation()
  const navigation = useContext(PanelNavigationContext)
  return (
    <TouchableBox
      {...props}
      onPress={event => {
        if (navigation?.openScreen)
          navigation.openScreen({
            title: t('Version'),
            width: 500,
            content: () => <VersionChoices version={version} onVersionChange={onVersionChange} />,
          })
        else onPress?.(event)
      }}
    />
  )
}
