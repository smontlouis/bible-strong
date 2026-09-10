import { useState, useRef, useEffect, useImperativeHandle, type Ref } from 'react'
import { ScrollView, type ScrollViewProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { FeatherIcon } from '~common/ui/Icon'
import { useHorizontalWheel } from './horizontalScroll/useHorizontalWheel.web'

export default function HorizontalControlScrollView({
  ref,
  ...props
}: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const wheel = useHorizontalWheel(element)
  const theme = useTheme()
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollView>(null)
  useImperativeHandle(ref, () => scrollRef.current!, [])
  useEffect(() => {
    setElement(scrollRef.current?.getScrollableNode() ?? null)
  }, [])
  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <ScrollView {...props} ref={scrollRef} horizontal />
      {([-1, 1] as const).map(
        direction =>
          (direction === -1 ? wheel.left : wheel.right) && (
            <button
              key={direction}
              type="button"
              aria-label={t(direction === -1 ? 'horizontalScroll.left' : 'horizontalScroll.right')}
              onClick={() => wheel.scroll(direction)}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                ...(direction === -1 ? { left: 0 } : { right: 0 }),
                width: 24,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 8,
                background: theme.colors.reverse,
                color: theme.colors.primary,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              }}
            >
              <FeatherIcon
                name={direction === -1 ? 'chevron-left' : 'chevron-right'}
                size={16}
                color="primary"
              />
            </button>
          )
      )}
    </div>
  )
}
