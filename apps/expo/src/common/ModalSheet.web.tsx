import { useImperativeHandle, useRef, useState } from 'react'
import { Modal } from '@heroui/react/modal'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { webFontFamily } from '~helpers/webFontFamily'
import { FeatherIcon } from './ui/Icon'
import type { ModalSheetProps } from './ModalSheet'
import './modal-sheet.css'
import { readSheetHeader } from './readSheetHeader'

export default function ModalSheet({
  ref,
  children,
  header,
  footer: Footer,
  modalTitle,
  accessibilityLabel,
  maxWidth = 550,
  dismissible = true,
  snapPoints,
  onPresent,
  onDismissStart,
  onDismiss,
  onClose,
  onOpenChange,
}: ModalSheetProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const opened = useRef(false)
  const close = () => {
    if (!opened.current) return
    opened.current = false
    onDismissStart?.()
    setOpen(false)
    onOpenChange?.(false)
    onClose?.()
    onDismiss?.()
  }
  useImperativeHandle(ref, () => {
    const present = () => {
      if (opened.current) return
      opened.current = true
      setOpen(true)
      onOpenChange?.(true)
      onPresent?.()
    }
    return {
      present,
      presentAt: present,
      resizeTo: () => {},
      dismiss: close,
      close,
      forceClose: close,
    }
  })
  const heading = readSheetHeader(header)
  const title = modalTitle ?? heading?.title ?? accessibilityLabel ?? t('Options')
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={value => {
        if (!value) close()
      }}
      isDismissable={dismissible}
      isKeyboardDismissDisabled={!dismissible}
      className="bs-modal-backdrop"
    >
      <div style={{ width: '100%', maxWidth }}>
        <Modal.Container placement="center" className="bs-modal-container">
          <Modal.Dialog
            className="bs-modal-dialog"
            style={{
              background: theme.colors.reverse,
              color: theme.colors.default,
              borderColor: theme.colors.border,
              fontFamily: webFontFamily(theme.fontFamily.text),
              ...(snapPoints?.includes(1) ? { height: 'min(720px, calc(100dvh - 48px))' } : {}),
            }}
          >
            <Modal.Header className="bs-modal-header">
              {heading?.hasBackButton && (
                <button
                  className="bs-modal-close"
                  aria-label={t('Retour')}
                  onClick={heading.onBackPress}
                >
                  <FeatherIcon name="arrow-left" size={18} />
                </button>
              )}
              {heading?.leftComponent}
              <Modal.Heading style={{ fontFamily: webFontFamily(theme.fontFamily.title) }}>
                {title}
              </Modal.Heading>
              {heading?.rightComponent}
              {dismissible && (
                <button className="bs-modal-close" aria-label={t('Fermer')} onClick={close}>
                  <FeatherIcon name="x" size={18} />
                </button>
              )}
            </Modal.Header>
            {heading?.subTitle && <div className="bs-modal-subtitle">{heading.subTitle}</div>}
            {heading?.children}
            <Modal.Body className="bs-modal-body">{children}</Modal.Body>
            {Footer && (
              <Modal.Footer className="bs-modal-footer">
                <Footer />
              </Modal.Footer>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </div>
    </Modal.Backdrop>
  )
}
