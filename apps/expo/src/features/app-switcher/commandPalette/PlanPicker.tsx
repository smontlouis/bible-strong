import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import PlanItem from '~features/plans/MyPlanListScreen/MyPlanItem'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import generateUUID from '~helpers/generateUUID'
import { useOpenInNewTab } from '../utils/useOpenInNewTab'
import type { ReactNode } from 'react'

export default function PlanPicker({ children }: { children: (open: () => void) => ReactNode }) {
  const { t } = useTranslation()
  const sheet = useRef<SheetRef>(null)
  const plans = useComputedPlanItems()
  const openTab = useOpenInNewTab()
  return (
    <>
      {children(() => sheet.current?.present())}
      <Sheet ref={sheet} snapPoints={[1]} header={<SheetHeader title={t('Plans')} />}>
        <SheetScrollView>
          {plans.length ? (
            <Box className="p-[20px] gap-[16px]">
              {plans.map(plan => (
                <PlanItem
                  key={plan.id}
                  {...plan}
                  onPress={() => {
                    sheet.current?.dismiss()
                    openTab(
                      {
                        id: generateUUID(),
                        type: 'plan',
                        title: plan.title,
                        isRemovable: true,
                        data: { planId: plan.id },
                      },
                      { autoRedirect: true }
                    )
                  }}
                />
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
    </>
  )
}
