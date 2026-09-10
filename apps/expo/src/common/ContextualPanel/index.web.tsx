import { Popover } from '@heroui/react/popover'
import { useImperativeHandle, useState, type ReactNode } from 'react'
import { HeaderActionContext, HeaderContentContext } from './HeaderActionContext'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { webFontFamily } from '~helpers/webFontFamily'
import { webThemeVariables } from '~themes/webThemeVariables'
import { FeatherIcon } from '~common/ui/Icon'
import type { ContextualPanelProps, PanelScreen, PanelNavigation } from './types'
import { usePanelNavigation } from './usePanelNavigation'
import PanelTransition from './PanelTransition'
import { PanelNavigationContext } from './NavigationContext'
import '../FiltersHeader.web.css'
export default function ContextualPanel(props: ContextualPanelProps) {
  const theme = useTheme()
  const panel = usePanelNavigation(props)
  useImperativeHandle(props.controllerRef, () => ({
    present: () => (panel.isOpen ? panel.navigation.close() : panel.present()),
    dismiss: panel.navigation.close,
  }))
  return (
    <Popover
      isOpen={panel.isOpen}
      onOpenChange={open => (open ? panel.present() : panel.navigation.close())}
    >
      {!props.anchorRef && (
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
      )}
      <Popover.Content
        triggerRef={props.anchorRef}
        shouldCloseOnInteractOutside={element => !props.anchorRef?.current?.contains(element)}
        placement="bottom"
        offset={8}
        className="bs-filter-popover"
        style={{
          ...webThemeVariables(theme.colors),
          width: panel.screen.width ?? props.width ?? 340,
          background: theme.colors.reverse,
          color: theme.colors.default,
          borderColor: theme.colors.border,
          fontFamily: webFontFamily(theme.fontFamily.text),
          fontSize: 14,
          lineHeight: '20px',
        }}
      >
        <Popover.Dialog>
          {panel.frames.map((frame, index) => (
            <PanelFrame
              key={frame.key}
              screen={frame.screen}
              navigation={panel.navigation}
              active={index === panel.frames.length - 1}
              canGoBack={index > 0}
              direction={panel.direction}
            />
          ))}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

type PanelFrameProps = {
  screen: PanelScreen
  navigation: PanelNavigation
  active: boolean
  canGoBack: boolean
  direction: 'forward' | 'backward'
}

function PanelFrame(props: PanelFrameProps) {
  // Keep the list element stable while the layout initializes its header portals.
  return <PanelFrameLayout {...props} content={props.screen.content(props.navigation)} />
}

function PanelFrameLayout({
  screen,
  navigation,
  active,
  canGoBack,
  direction,
  content,
}: PanelFrameProps & { content: ReactNode }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null)
  const [contentTarget, setContentTarget] = useState<HTMLDivElement | null>(null)
  return (
    <div hidden={!active}>
      <PanelNavigationContext.Provider value={navigation}>
        <HeaderActionContext.Provider value={active ? actionTarget : null}>
          <HeaderContentContext.Provider value={active ? contentTarget : null}>
            <PanelTransition direction={direction}>
              <div
                className="bs-filter-heading"
                style={screen.hideHeader ? { display: 'none' } : undefined}
              >
                {canGoBack && (
                  <button
                    className="bs-panel-back"
                    aria-label={t('Retour')}
                    onClick={navigation.back}
                  >
                    <FeatherIcon name="arrow-left" size={17} />
                  </button>
                )}
                {active ? (
                  <Popover.Heading style={{ fontFamily: webFontFamily(theme.fontFamily.title) }}>
                    {screen.title}
                  </Popover.Heading>
                ) : (
                  <h2>{screen.title}</h2>
                )}
                {screen.headerRight}
                <div ref={setActionTarget} style={{ display: 'contents' }} />
              </div>
              {screen.headerContent}
              <div ref={setContentTarget} />
              <div className="bs-filter-options">{content}</div>
              {screen.footer}
            </PanelTransition>
          </HeaderContentContext.Provider>
        </HeaderActionContext.Provider>
      </PanelNavigationContext.Provider>
    </div>
  )
}
