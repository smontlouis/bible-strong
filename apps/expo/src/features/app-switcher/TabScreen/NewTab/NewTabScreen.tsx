import { PrimitiveAtom } from 'jotai/vanilla'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { useAtom } from 'jotai/react'
import React from 'react'
import { Platform, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import PlanItem from '~features/plans/MyPlanListScreen/MyPlanItem'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import { NewTab, TabItem } from '../../../../state/tabs'
import NewTabContent from './NewTabContent'
import { useTheme } from '~themes/ThemeProvider'
import { SelectBibleReferenceModalProvider } from './SelectBibleReferenceModalProvider'
import SheetWell from '~common/ui/SheetWell'
import { ListSeparator } from '~common/ui/ListSection'
export interface NewTabScreenProps {
  newAtom: PrimitiveAtom<NewTab>
}

const NewTabScreen = ({ newAtom }: NewTabScreenProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  // Matches the phone layout of NewTabContent (available width under 660px, native only).
  const dense = Platform.OS !== 'web' && width < 660
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const [, setTab] = useAtom(newAtom as unknown as PrimitiveAtom<TabItem>)
  const planSelectorRef = React.useRef<SheetRef>(null)
  const plans = useComputedPlanItems()

  return (
    <SelectBibleReferenceModalProvider>
      <Box className="flex-1 bg-canvas">
        <ScrollView
          style={{
            flex: 1,
            backgroundColor: theme.colors.canvas,
            ...(Platform.OS === 'web' ? { scrollbarGutter: 'stable' } : {}),
          }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <Box
            className="w-full self-center"
            style={{
              maxWidth: 800,
              paddingHorizontal: dense ? 20 : 24,
              paddingTop: insets.top + (dense ? 24 : 44),
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
              <SheetWell className="mx-[20px] my-[20px]">
                {plans.map((plan, index) => (
                  <React.Fragment key={plan.id}>
                    {index > 0 && <ListSeparator />}
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
                  </React.Fragment>
                ))}
              </SheetWell>
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
