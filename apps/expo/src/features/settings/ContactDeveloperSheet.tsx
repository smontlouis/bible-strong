import { type RefObject, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking } from 'react-native'
import Sheet from '~common/ModalSheet'
import { SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { toast } from '~helpers/toast'
import { buildSupportEmail, SUPPORT_EMAIL } from './contactDeveloper'
import { copySupportEmail } from './supportClipboard'
import { getSupportDiagnostics } from './supportDiagnostics'

export default function ContactDeveloperSheet({
  modalRef,
}: {
  modalRef: RefObject<SheetRef | null>
}) {
  const { t, i18n } = useTranslation()
  const opening = useRef(false)
  const [busy, setBusy] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)
  const choices = [
    {
      label: t('contact.feedback'),
      icon: 'message-circle' as const,
      body: t('contact.feedbackBody'),
    },
    { label: t('contact.bug'), icon: 'alert-circle' as const, body: t('contact.bugBody') },
    { label: t('contact.suggestion'), icon: 'star' as const, body: t('contact.suggestionBody') },
    { label: t('contact.other'), icon: 'mail' as const, body: t('contact.otherBody') },
  ]

  const openEmail = async (choice: (typeof choices)[number]) => {
    if (opening.current) return
    opening.current = true
    setBusy(true)
    setFallback(null)
    try {
      const email = buildSupportEmail(
        `[Bible Strong] ${choice.label}`,
        choice.body,
        t('contact.diagnostics'),
        getSupportDiagnostics(i18n.language)
      )
      // Keep a manual fallback: some mail handlers resolve without opening a configured account.
      setFallback(email.text)
      await Linking.openURL(email.url)
    } catch {
      toast.error(t('contact.mailUnavailable'))
    } finally {
      opening.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet
      ref={modalRef}
      header={<SheetHeader title={t('Contacter le développeur')} />}
      onDismiss={() => setFallback(null)}
    >
      <SheetView>
        <Box className="gap-3 px-5 py-4">
          <Text className="text-grey text-sm">{t('contact.intro')}</Text>
          {choices.map(choice => (
            <TouchableBox
              key={choice.label}
              accessibilityRole="button"
              accessibilityLabel={choice.label}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => openEmail(choice)}
              className="flex-row items-center gap-3 rounded-2xl bg-light-grey p-4"
            >
              <FeatherIcon name={choice.icon} size={22} color="primary" />
              <Text className="flex-1 font-semibold">{choice.label}</Text>
              <FeatherIcon name="chevron-right" size={20} color="grey" />
            </TouchableBox>
          ))}
          <Text className="text-grey text-xs">{t('contact.diagnosticNotice')}</Text>
          {fallback && (
            <TouchableBox
              accessibilityRole="button"
              onPress={async () => {
                try {
                  await copySupportEmail(fallback)
                  toast.success(t('contact.copied'))
                } catch {
                  toast.error(t('contact.copyFailed'))
                }
              }}
              className="gap-1 rounded-2xl border border-border p-4"
            >
              <Text className="text-primary font-semibold">{t('contact.copyEmail')}</Text>
              <Text className="text-grey text-sm">{SUPPORT_EMAIL}</Text>
            </TouchableBox>
          )}
        </Box>
      </SheetView>
    </Sheet>
  )
}
