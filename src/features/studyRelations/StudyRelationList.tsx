import { Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import type { RootState } from '~redux/modules/reducer'
import {
  deleteStudyRelation,
  type RelationEndpoint,
  type RelationType,
  updateStudyRelation,
} from '~redux/modules/user'
import { makeStudyRelationDisplayModelsSelector } from '~redux/selectors/bible'

type Props = {
  endpoint: RelationEndpoint
  onOpenEndpoint: (endpoint: RelationEndpoint) => void
  onCreateRelation?: () => void
}

const typeCycle: RelationType[] = ['linked', 'references', 'explains', 'contrasts']

const getNextType = (type: RelationType): RelationType => {
  const index = typeCycle.indexOf(type)
  return typeCycle[(index + 1) % typeCycle.length]
}

const selectDisplayModels = makeStudyRelationDisplayModelsSelector()

const StudyRelationList = ({ endpoint, onOpenEndpoint, onCreateRelation }: Props) => {
  const dispatch = useDispatch()
  const relations = useSelector((state: RootState) => selectDisplayModels(state, endpoint))

  if (relations.length === 0 && !onCreateRelation) return null

  return (
    <VStack gap={10}>
      <HStack alignItems="center" justifyContent="space-between">
        <Text title fontSize={16}>
          Relations d’étude
        </Text>
        {onCreateRelation ? (
          <Button small onPress={onCreateRelation}>
            Ajouter
          </Button>
        ) : null}
      </HStack>

      {relations.length === 0 ? (
        <Text color="grey">Aucune relation</Text>
      ) : (
        relations.map(model => (
          <Box
            key={model.relation.id}
            borderWidth={1}
            borderColor="border"
            borderRadius={8}
            px={12}
            py={10}
          >
            <TouchableBox onPress={() => onOpenEndpoint(model.targetEndpoint)}>
              <VStack gap={4}>
                <Text bold>{model.targetLabel}</Text>
                <Text fontSize={13} color="grey">
                  {model.relationText} · {model.subtitle}
                </Text>
                {model.relation.label ? (
                  <Text fontSize={13}>{model.relation.label}</Text>
                ) : null}
              </VStack>
            </TouchableBox>

            <HStack mt={10} gap={8} wrap>
              <Button
                small
                secondary
                onPress={() => {
                  const nextType = getNextType(model.relation.type)
                  dispatch(
                    updateStudyRelation({
                      id: model.relation.id,
                      changes: {
                        type: nextType,
                        direction:
                          nextType === 'references' || nextType === 'explains' ? 'forward' : 'none',
                      },
                    })
                  )
                }}
              >
                Type
              </Button>
              {(model.relation.type === 'references' || model.relation.type === 'explains') && (
                <Button
                  small
                  secondary
                  onPress={() =>
                    dispatch(
                      updateStudyRelation({
                        id: model.relation.id,
                        changes: {
                          direction: model.relation.direction === 'forward' ? 'backward' : 'forward',
                        },
                      })
                    )
                  }
                >
                  Direction
                </Button>
              )}
              <Button
                small
                color="quart"
                onPress={() =>
                  Alert.alert('Supprimer la relation', 'Voulez-vous supprimer cette relation?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: () => dispatch(deleteStudyRelation(model.relation.id)),
                    },
                  ])
                }
              >
                Supprimer
              </Button>
            </HStack>
          </Box>
        ))
      )}
    </VStack>
  )
}

export default StudyRelationList
