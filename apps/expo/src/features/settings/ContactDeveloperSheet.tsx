import React from 'react'
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
import SheetWell from '~common/ui/SheetWell'
import IconTile, { ICON_TILE_SIZE } from '~common/ui/IconTile'
import { ListSeparator } from '~common/ui/ListSection'

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
          <SheetWell>
            {choices.map((choice, index) => (
              <React.Fragment key={choice.label}>
                {index > 0 && <ListSeparator inset={14 + ICON_TILE_SIZE + 12} />}
                <TouchableBox
                  accessibilityRole="button"
                  accessibilityLabel={choice.label}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => openEmail(choice)}
                  className="flex-row items-center gap-[12px] px-[14px] py-[11px]"
                >
                  <IconTile tint="primary">
                    <FeatherIcon name={choice.icon} size={16} color="primary" />
                  </IconTile>
                  <Text className="flex-1 text-[15px]">{choice.label}</Text>
                  <FeatherIcon name="chevron-right" size={18} color="grey" />
                </TouchableBox>
              </React.Fragment>
            ))}
          </SheetWell>
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
            >
              <SheetWell className="gap-1 p-4">
                <Text className="text-link font-semibold">{t('contact.copyEmail')}</Text>
                <Text className="text-grey text-sm">{SUPPORT_EMAIL}</Text>
              </SheetWell>
            </TouchableBox>
          )}
        </Box>
      </SheetView>
    </Sheet>
  )
}
