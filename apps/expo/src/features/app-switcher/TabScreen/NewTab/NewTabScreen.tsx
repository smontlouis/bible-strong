import { PrimitiveAtom } from 'jotai/vanilla'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { useAtom } from 'jotai/react'
import React from 'react'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Spacer from '~common/ui/Spacer'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import PlanItem from '~features/plans/MyPlanListScreen/MyPlanItem'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import { NewTab, TabItem } from '../../../../state/tabs'
import NewTabContent from './NewTabContent'
import { useTheme } from '~themes/ThemeProvider'
import { SelectBibleReferenceModalProvider } from './SelectBibleReferenceModalProvider'
export interface NewTabScreenProps {
  newAtom: PrimitiveAtom<NewTab>
}

const NewTabScreen = ({ newAtom }: NewTabScreenProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const [, setTab] = useAtom(newAtom as unknown as PrimitiveAtom<TabItem>)
  const planSelectorRef = React.useRef<SheetRef>(null)
  const plans = useComputedPlanItems()

  return (
    <SelectBibleReferenceModalProvider>
      <Box className="flex-1 bg-light-grey">
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.colors.lightGrey }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <Box
            className="w-full self-center px-[24px]"
            style={{
              maxWidth: 800,
              paddingTop: insets.top + 44,
              paddingBottom: bottomBarHeight + 40,
            }}
          >
            <NewTabContent
              tabAtom={newAtom as unknown as PrimitiveAtom<TabItem>}
              onPlanPress={() => planSelectorRef.current?.present()}
            />
          </Box>
        </ScrollView>
        <Sheet ref={planSelectorRef} snapPoints={[1]} header={<SheetHeader title={t('Plans')} />}>
          <SheetScrollView>
            {plans.length ? (
              <Box className="overflow-hidden border-continuous px-[20px] py-[20px]">
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
      </Box>
    </SelectBibleReferenceModalProvider>
  )
}

export default NewTabScreen
