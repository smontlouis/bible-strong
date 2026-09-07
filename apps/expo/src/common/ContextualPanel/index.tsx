import { useEffect, useRef } from 'react'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import { TouchableBox } from '~common/ui/Box'
import type { ContextualPanelProps } from './types'
import { usePanelNavigation } from './usePanelNavigation'
export default function ContextualPanel(props: ContextualPanelProps) {
  const panel = usePanelNavigation(props)
  const ref = useRef<SheetRef>(null)
  useEffect(() => {
    if (panel.isOpen) ref.current?.present()
    else ref.current?.dismiss()
  }, [panel.isOpen])
  return (
    <>
      <TouchableBox
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        onPress={panel.present}
      >
        {props.trigger}
      </TouchableBox>
      <Sheet
        ref={ref}
        onDismiss={panel.navigation.close}
        header={
          <SheetHeader
            title={panel.screen.title}
            hasBackButton={panel.canGoBack}
            onBackPress={panel.navigation.back}
            rightComponent={panel.screen.headerRight}
          />
        }
      >
        <SheetScrollView>{panel.screen.content(panel.navigation)}</SheetScrollView>
      </Sheet>
    </>
  )
}
