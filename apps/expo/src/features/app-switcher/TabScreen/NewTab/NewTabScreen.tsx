import { PrimitiveAtom } from 'jotai/vanilla'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
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
  const planSelectorRef = React.useRef<SheetRef>(null)
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
        <Sheet ref={planSelectorRef} snapPoints={[1]} header={<SheetHeader title={t('Plans')} />}>
          <SheetScrollView>
            {plans.length ? (
              <Box px={20} py={20}>
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
          </SheetScrollView>
        </Sheet>
      </Container>
    </SelectBibleReferenceModalProvider>
  )
}

export default NewTabScreen
