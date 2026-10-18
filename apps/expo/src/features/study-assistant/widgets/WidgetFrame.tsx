import { useState, type ComponentProps, type ReactNode } from 'react'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'

type IconName = ComponentProps<typeof FeatherIcon>['name']

/** The card every study widget sits in. The sheet is already full width: no enlarged view. */
export default function WidgetFrame({
  title,
  eyebrow,
  children,
  icon = 'book-open',
  leading,
}: {
  title: string
  eyebrow: string
  children: ReactNode
  icon?: IconName
  /** Replaces the icon, for a control such as a way back. */
  leading?: ReactNode
}) {
  return (
    <Box className="border-border bg-reverse my-2 overflow-hidden rounded-[16px] border">
      <HStack className="border-border items-center gap-[10px] border-b px-3 py-[10px]">
        {leading || <FeatherIcon name={icon} size={17} color="primary" />}
        <Box className="flex-1">
          <Text className="text-grey text-[11px] font-semibold uppercase">{eyebrow}</Text>
          <Text className="text-[15px] font-bold" numberOfLines={2}>
            {title}
          </Text>
        </Box>
      </HStack>
      {children}
    </Box>
  )
}

export function WidgetIconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      className="h-[32px] w-[32px] items-center justify-center"
      style={{ opacity: disabled ? 0.35 : 1 }}
    >
      <FeatherIcon name={icon} size={17} color="primary" />
    </TouchableBox>
  )
}

/** A labelled way out of the conversation, towards the full resource. */
export function WidgetOpenButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableBox
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-1 self-start py-1"
    >
      <Text className="text-primary text-[14px] font-semibold">{label}</Text>
      <FeatherIcon name="arrow-up-right" size={15} color="primary" />
    </TouchableBox>
  )
}

export function WidgetLoading() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  return (
    <Box
      accessibilityLabel={t('Chargement...')}
      className="min-h-[72px] items-center justify-center"
    >
      <ActivityIndicator color={colors.primary} />
    </Box>
  )
}

/** A resource the app could not read: said plainly, never replaced by generated text. */
export function WidgetUnavailable({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  return (
    <Box className="gap-1 py-2">
      <Text className="text-grey text-[14px]">
        {message || t('assistant.widgets.resourceUnavailable')}
      </Text>
      {onRetry && (
        <TouchableBox accessibilityRole="button" onPress={onRetry} className="self-start py-1">
          <Text className="text-primary text-[14px] font-semibold">
            {t('assistant.errors.retry')}
          </Text>
        </TouchableBox>
      )}
    </Box>
  )
}

export function WidgetNotice({ children }: { children: string }) {
  return <Text className="text-grey text-[13px] leading-[19px]">{children}</Text>
}

/** Secondary content folded behind its own heading. */
export function WidgetDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Box className="border-border mt-2 border-t pt-2">
      <TouchableBox
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)}
        className="flex-row items-center justify-between py-1"
      >
        <Text className="flex-1 text-[14px] font-semibold">{title}</Text>
        <FeatherIcon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="grey" />
      </TouchableBox>
      {open && <Box className="pt-1">{children}</Box>}
    </Box>
  )
}
