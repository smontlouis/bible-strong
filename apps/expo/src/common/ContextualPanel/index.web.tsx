import { Popover } from '@heroui/react/popover'
import { useState } from 'react'
import { HeaderActionContext } from './HeaderActionContext'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { webFontFamily } from '~helpers/webFontFamily'
import { FeatherIcon } from '~common/ui/Icon'
import type { ContextualPanelProps } from './types'
import { usePanelNavigation } from './usePanelNavigation'
import PanelTransition from './PanelTransition'
import '../FiltersHeader.web.css'
export default function ContextualPanel(props: ContextualPanelProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const panel = usePanelNavigation(props)
  const [headerActionTarget, setHeaderActionTarget] = useState<HTMLDivElement | null>(null)
  return (
    <Popover
      isOpen={panel.isOpen}
      onOpenChange={open => (open ? panel.present() : panel.navigation.close())}
    >
      <Popover.Trigger
        className="bs-filter-trigger"
        aria-label={props.accessibilityLabel}
        style={{
          fontFamily: webFontFamily(theme.fontFamily.text),
          padding: 0,
          ...(props.triggerSize
            ? { width: props.triggerSize, height: props.triggerSize, justifyContent: 'center' }
            : {}),
        }}
      >
        {props.trigger}
      </Popover.Trigger>
      <Popover.Content
        placement="bottom end"
        offset={8}
        className="bs-filter-popover"
        style={{
          width: props.width ?? 340,
          background: theme.colors.reverse,
          color: theme.colors.default,
          borderColor: theme.colors.border,
          fontFamily: webFontFamily(theme.fontFamily.text),
          fontSize: 14,
          lineHeight: '20px',
        }}
      >
        <Popover.Dialog>
          <HeaderActionContext.Provider value={headerActionTarget}>
            <PanelTransition key={panel.screenKey} direction={panel.direction}>
              <div className="bs-filter-heading">
                {panel.canGoBack && (
                  <button
                    className="bs-panel-back"
                    aria-label={t('Retour')}
                    onClick={panel.navigation.back}
                  >
                    <FeatherIcon name="arrow-left" size={17} />
                  </button>
                )}
                <Popover.Heading style={{ fontFamily: webFontFamily(theme.fontFamily.title) }}>
                  {panel.screen.title}
                </Popover.Heading>
                {panel.screen.headerRight}
                <div ref={setHeaderActionTarget} style={{ display: 'contents' }} />
              </div>
              {panel.screen.headerContent}
              <div className="bs-filter-options">{panel.screen.content(panel.navigation)}</div>
            </PanelTransition>
          </HeaderActionContext.Provider>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
