import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import { AnimatedBox, AnimatedTouchableBox } from '~common/ui/Box'
import StrongModeSelectorSheet from './StrongModeSelectorSheet'
import InterlinearModeSelectorSheet from './InterlinearModeSelectorSheet'
import type { DisplayModeTriggerProps } from './DisplayModeTrigger'
export default function DisplayModeTrigger({
  kind,
  bibleAtom,
  children,
  className,
  disabled,
  accessibilityLabel,
  style,
  ...props
}: DisplayModeTriggerProps) {
  const { t } = useTranslation()
  if (disabled)
    return (
      <AnimatedTouchableBox
        {...props}
        className={className}
        style={style}
        disabled
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </AnimatedTouchableBox>
    )
  return (
    <ContextualPanel
      width={460}
      initialScreen="modes"
      accessibilityLabel={accessibilityLabel || t('Affichage du texte')}
      trigger={
        <AnimatedBox className={className} style={style}>
          {children}
        </AnimatedBox>
      }
      screens={{
        modes: {
          title: t('Affichage du texte'),
          content: nav =>
            kind === 'strong' ? (
              <StrongModeSelectorSheet bibleAtom={bibleAtom} inline onClose={nav.close} />
            ) : (
              <InterlinearModeSelectorSheet bibleAtom={bibleAtom} inline onClose={nav.close} />
            ),
        },
      }}
    />
  )
}
