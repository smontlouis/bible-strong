import { Fragment, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Empty from '~common/Empty'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { getEditorialKind } from '~features/plans/readingCalendar'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import generateUUID from '~helpers/generateUUID'
import { useOpenInNewTab } from '../utils/useOpenInNewTab'
import type { ReactNode } from 'react'
import { useStore } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import type { TabItem } from '~state/tabs'

export default function PlanPicker({
  children,
  tabAtom,
}: {
  children: (open: () => void) => ReactNode
  tabAtom?: PrimitiveAtom<TabItem>
}) {
  const { t } = useTranslation()
  const sheet = useRef<SheetRef>(null)
  const plans = useComputedPlanItems()
  const openTab = useOpenInNewTab()
  const store = useStore()
  const replacement = useRef<PrimitiveAtom<TabItem> | undefined>(undefined)
  return (
    <>
      {children(() => {
        replacement.current = tabAtom
        sheet.current?.present()
      })}
      <Sheet ref={sheet} snapPoints={[1]} header={<SheetHeader title={t('Plans & Méditations')} />}>
        <SheetScrollView>
          {plans.length ? (
            // A list in a sheet: full-width rows split by hairlines.
            <Box className="px-[20px] py-[8px]">
              {plans.map((plan, index) => (
                <Fragment key={plan.id}>
                  {index > 0 && <Border />}
                  <Link
                    onPress={() => {
                      sheet.current?.dismiss()
                      const nextTab: TabItem = {
                        id: generateUUID(),
                        type: 'plan',
                        title: plan.title,
                        isRemovable: true,
                        data: { planId: plan.id },
                      }
                      const target = replacement.current
                      if (target) {
                        const previous = store.get(target)
                        if (previous.type === 'new')
                          store.set(target, { ...nextTab, id: previous.id })
                      } else openTab(nextTab, { autoRedirect: true })
                    }}
                  >
                    <Box className="py-[12px] gap-[4px] min-h-[64px] justify-center">
                      <Text className="text-default font-bold">{plan.title}</Text>
                      <Text className="text-grey text-[13px]">
                        {t(
                          getEditorialKind(plan) === 'daily-meditation'
                            ? 'dailyReading.collection'
                            : 'readingPlans.tab'
                        )}
                      </Text>
                    </Box>
                  </Link>
                </Fragment>
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
