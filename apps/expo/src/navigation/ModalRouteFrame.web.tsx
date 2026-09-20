import { finishPageTransition } from './pageTransition'
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '~themes/ThemeProvider'
import { useSetAtom } from 'jotai'
import {
  useNavigationContainerRef,
  useRouter,
  useGlobalSearchParams,
  useIsFocused,
} from 'expo-router'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useWorkspaceRoutePanel, workspacePanelClosingAtom } from './useWorkspaceRoutePanel'
import { usePublicShell } from './PublicShellContext'

const ModalRouteFrame = ({ children }: { children: ReactNode }) => {
  const publicShell = usePublicShell()
  const { enabled, open, panelWidth, reservedWidth, closeTarget } = useWorkspaceRoutePanel()
  const isFocused = useIsFocused()
  const routeParams = useGlobalSearchParams()
  useLayoutEffect(() => {
    finishPageTransition()
  }, [routeParams])
  const theme = useTheme()
  const router = useRouter()
  const navigation = useNavigationContainerRef()
  const { t } = useTranslation()
  const setClosing = useSetAtom(workspacePanelClosingAtom)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(closeTimer.current)
      setClosing(false)
    },
    [setClosing]
  )
  const close = () => {
    if (closeTimer.current) return
    const back = () => {
      if (closeTarget && closeTarget.count > 0) {
        navigation.dispatch({
          type: 'POP',
          payload: { count: closeTarget.count },
          target: closeTarget.key,
        })
      } else {
        router.replace('/')
      }
      setClosing(false)
      closeTimer.current = undefined
    }
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      back()
      return
    }
    setClosing(true)
    closeTimer.current = setTimeout(back, 240)
  }

  if (publicShell.active) {
    return <Box className="flex-1 min-w-0 bg-reverse overflow-hidden">{children}</Box>
  }

  return (
    <Box testID="workspace-route-frame" className="flex-1 items-end" pointerEvents="box-none">
      {enabled &&
        open &&
        isFocused &&
        typeof document !== 'undefined' &&
        createPortal(
          <TouchableBox
            testID="workspace-panel-close"
            className="w-[32px] h-[36px] rounded-l-[8px] items-center justify-center"
            style={{
              top: 62,
              right: reservedWidth,
              zIndex: 100,
              backgroundColor: theme.colors.reverse,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Fermer')}
            onPress={close}
          >
            <FeatherIcon name="chevron-right" size={18} />
          </TouchableBox>,
          document.body
        )}
      <Box
        testID="workspace-route-panel"
        className="flex-1 bg-reverse border-l border-border overflow-hidden"
        style={{
          width: enabled ? reservedWidth : '100%',
          borderLeftWidth: enabled ? 1 : 0,
        }}
      >
        <Box className="flex-1 self-end" style={{ width: enabled ? panelWidth : '100%' }}>
          <Box className="flex-1 min-h-0">{children}</Box>
        </Box>
      </Box>
    </Box>
  )
}

export default ModalRouteFrame
