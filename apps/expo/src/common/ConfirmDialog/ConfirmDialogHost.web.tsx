import { useAtom } from 'jotai'
import { AlertDialog } from '@heroui/react/alert-dialog'
import { Button } from '@heroui/react/button'
import { useTheme } from '~themes/ThemeProvider'
import { webFontFamily } from '~helpers/webFontFamily'
import { confirmRequestsAtom } from './state'
import './confirm-dialog.css'

export default function ConfirmDialogHost() {
  const [requests, setRequests] = useAtom(confirmRequestsAtom)
  const request = requests[0]
  const theme = useTheme()
  const finish = (confirmed: boolean) => {
    if (!request) return
    setRequests(current => current.filter(item => item !== request))
    request.resolve(confirmed)
  }
  return (
    <AlertDialog.Backdrop
      isOpen={!!request}
      onOpenChange={open => {
        if (!open) finish(false)
      }}
      isDismissable={false}
      isKeyboardDismissDisabled={false}
      className="bs-confirm-backdrop"
    >
      <AlertDialog.Container placement="center" className="bs-confirm-container">
        <AlertDialog.Dialog
          className="bs-confirm-dialog"
          style={{
            background: theme.colors.reverse,
            color: theme.colors.default,
            borderColor: theme.colors.border,
            fontFamily: webFontFamily(theme.fontFamily.text),
          }}
        >
          <AlertDialog.Header>
            <AlertDialog.Heading style={{ fontFamily: webFontFamily(theme.fontFamily.title) }}>
              {request?.options.title}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{request?.options.message}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer className="bs-confirm-footer">
            <Button
              autoFocus
              className="bs-confirm-button"
              style={{ background: theme.colors.lightGrey, color: theme.colors.default }}
              onPress={() => finish(false)}
            >
              {request?.options.cancelLabel}
            </Button>
            <Button
              className="bs-confirm-button"
              style={{
                background: request?.options.destructive
                  ? theme.colors.quart
                  : theme.colors.primary,
                color: '#fff',
              }}
              onPress={() => finish(true)}
            >
              {request?.options.confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
