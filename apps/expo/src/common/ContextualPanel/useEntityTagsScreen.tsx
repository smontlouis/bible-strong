import { useState } from 'react'
import { Platform } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import type { RootState } from '~redux/modules/reducer'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Checkbox from '~common/ui/Checkbox'
import PanelSearch from './PanelSearch'
import PanelAction from './PanelAction'
import type { PanelScreen } from './types'

export function useEntityTagsScreen(entity: 'studies' | 'links', id: string) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [query, setQuery] = useState('')
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const selected = useSelector((state: RootState) => state.user.bible[entity][id]?.tags)
  const valid = Object.values(tags ?? {}).filter(
    tag => tag && typeof tag.name === 'string' && typeof tag.id === 'string'
  )
  const matches = valid
    .filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const screen: PanelScreen = {
    title: t('Éditer les tags'),
    headerContent: <PanelSearch value={query} onChange={setQuery} />,
    content: () => (
      <>
        {matches.map(tag => (
          <TouchableBox
            key={tag.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected?.[tag.id] }}
            onPress={() => dispatch(toggleTagEntity({ item: { entity, id }, tagId: tag.id }))}
            className={
              Platform.OS === 'web'
                ? 'w-full flex-row gap-3 items-center p-3 rounded-lg'
                : 'w-full flex-row gap-3 items-center p-[16px] border-b border-border'
            }
          >
            <Checkbox checked={!!selected?.[tag.id]} />
            <Text className={Platform.OS === 'web' ? 'flex-1 text-[14px]' : 'flex-1 text-[16px]'}>
              {tag.name}
            </Text>
          </TouchableBox>
        ))}
        {!!query.trim() &&
          !valid.some(tag => tag.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase()) && (
            <PanelAction
              icon="plus"
              label={t('Créer') + ' « ' + query.trim() + ' »'}
              onPress={() => {
                const action = addTag(query.trim())
                dispatch(action)
                dispatch(toggleTagEntity({ item: { entity, id }, tagId: action.payload.id }))
                setQuery('')
              }}
            />
          )}
      </>
    ),
  }
  return { screen, reset: () => setQuery('') }
}
