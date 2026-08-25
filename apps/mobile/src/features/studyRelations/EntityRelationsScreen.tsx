import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useSheet } from '~helpers/useSheet'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import CreateEntityRelationModal from './CreateEntityRelationModal'
import StudyRelationList from './StudyRelationList'
import { getEndpointFallbackLabel } from './domain'
import { parseRelationEndpointParam } from './routeParams'
import { useOpenRelationEndpoint } from './useOpenRelationEndpoint'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { IS_FORM_SHEET } from '~helpers/constants'

const EntityRelationsScreen = () => {
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ endpoint?: string }>()
  const endpoint = parseRelationEndpointParam(params.endpoint)
  const openEndpoint = useOpenRelationEndpoint()
  const createRelationModal = useSheet()
  const isFormSheet = IS_FORM_SHEET
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
  const isSingleVerseEndpoint = endpoint?.type === 'verse' && endpoint.verseKeys.length === 1
  const endpointLabel = endpoint ? getEndpointFallbackLabel(endpoint) : ''

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
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
      <ScrollView>
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
        <CreateEntityRelationModal
          ref={createRelationModal.getRef()}
          sourceEndpoint={endpoint}
          onCreated={() => createRelationModal.close()}
        />
      </ScrollView>
    </FormSheetScreen>
  )
}

export default EntityRelationsScreen
