import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import Empty from '~common/Empty'
import ModalHeader from '~common/ModalHeader'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import CreateEntityRelationModal from './CreateEntityRelationModal'
import StudyRelationList from './StudyRelationList'
import { getEndpointFallbackLabel } from './domain'
import { parseRelationEndpointParam } from './routeParams'
import { useOpenRelationEndpoint } from './useOpenRelationEndpoint'

const EntityRelationsScreen = () => {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ endpoint?: string }>()
  const endpoint = parseRelationEndpointParam(params.endpoint)
  const openEndpoint = useOpenRelationEndpoint()
  const createRelationModal = useBottomSheetModal()
  const isSingleVerseEndpoint = endpoint?.type === 'verse' && endpoint.verseKeys.length === 1
  const endpointLabel = endpoint ? getEndpointFallbackLabel(endpoint) : ''

  return (
    <Box bg="reverse">
      <ModalHeader
        title={t('Relations')}
        subTitle={endpointLabel}
        rightComponent={
          endpoint ? (
            <TouchableBox
              onPress={() => createRelationModal.open()}
              mr={15}
              borderRadius={18}
              bg="primary"
              width={28}
              height={28}
              alignItems="center"
              justifyContent="center"
            >
              <FeatherIcon name="plus" size={16} color="reverse" />
            </TouchableBox>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ flex: 1 }}>
        {endpoint ? (
          <StudyRelationList
            endpoint={endpoint}
            onOpenEndpoint={openEndpoint}
            showEmptyState
            includeStartingVerseRelations={isSingleVerseEndpoint}
          />
        ) : (
          <Box flex justifyContent="center" px={20}>
            <Empty
              icon={require('~assets/images/empty-state-icons/link.svg')}
              message={t('Aucune relation')}
            />
          </Box>
        )}
      </ScrollView>
      <CreateEntityRelationModal
        ref={createRelationModal.getRef()}
        sourceEndpoint={endpoint}
        onCreated={() => createRelationModal.close()}
      />
    </Box>
  )
}

export default EntityRelationsScreen
