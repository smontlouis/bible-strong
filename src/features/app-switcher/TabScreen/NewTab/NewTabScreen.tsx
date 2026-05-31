import { PrimitiveAtom } from 'jotai/vanilla'
import { BottomSheetModal } from '~common/bottom-sheet'
import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import Spacer from '~common/ui/Spacer'
import ScrollView from '~common/ui/ScrollView'
import PlanItem from '~features/plans/MyPlanListScreen/MyPlanItem'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import { NewTab, TabItem, tabTypes } from '../../../../state/tabs'
import NewTabItem from './NewTabItem'
import { SelectBibleReferenceModalProvider } from './SelectBibleReferenceModalProvider'

export interface NewTabScreenProps {
  newAtom: PrimitiveAtom<NewTab>
}

const NewTabScreen = ({ newAtom }: NewTabScreenProps) => {
  const { t } = useTranslation()
  const [, setTab] = useAtom(newAtom as unknown as PrimitiveAtom<TabItem>)
  const planSelectorRef = React.useRef<BottomSheetModal>(null)
  const plans = useComputedPlanItems()

  return (
    <SelectBibleReferenceModalProvider>
      <Container>
        <Header title={t('tabs.new')} />
        <ScrollView backgroundColor="lightGrey">
          <Box px={20} pt={20} pb={40} gap={12}>
            {tabTypes.map(type => (
              <NewTabItem
                key={type}
                type={type}
                newAtom={newAtom as unknown as PrimitiveAtom<TabItem>}
                onPlanPress={() => planSelectorRef.current?.present()}
              />
            ))}
          </Box>
        </ScrollView>
        <Modal.Body ref={planSelectorRef} snapPoints={['70%']} enableDynamicSizing={false}>
          <Box px={20} pt={10} pb={15}>
            <Text title fontSize={18}>
              {t('Plans')}
            </Text>
          </Box>
          {plans.length ? (
            <Box px={20} pb={20} gap={10}>
              {plans.map((plan, index) => (
                <React.Fragment key={plan.id}>
                  <PlanItem
                    {...plan}
                    onPress={() => {
                      planSelectorRef.current?.dismiss()
                      setTab(tab => ({
                        ...tab,
                        title: plan.title,
                        type: 'plan',
                        data: { planId: plan.id },
                      }))
                    }}
                  />
                  {index < plans.length - 1 && <Spacer />}
                </React.Fragment>
              ))}
            </Box>
          ) : (
            <Empty
              icon={require('~assets/images/empty-state-icons/plan.svg')}
              message={t("Vous n'avez aucun plan...")}
            />
          )}
        </Modal.Body>
      </Container>
    </SelectBibleReferenceModalProvider>
  )
}

export default NewTabScreen
