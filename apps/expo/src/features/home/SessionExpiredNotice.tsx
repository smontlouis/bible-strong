import React from 'react'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Card from '~common/ui/Card'
import IconTile from '~common/ui/IconTile'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { twMerge } from '~common/ui/classNames'
import useConnection from '~helpers/useConnection'
import useLogin from '~helpers/useLogin'

/**
 * Firebase ended the session while the app still shows the account: the edits stay on the device
 * and wait to be sent. Signing in again needs a connection, so offline the notice only says so.
 * It stays until the reader signs in again or out.
 */
const SessionExpiredNotice = ({ className }: { className?: string }) => {
  const { isSessionLost } = useLogin()
  const isConnected = useConnection()
  const { t } = useTranslation()

  if (!isSessionLost) return null

  return (
    <Card className={twMerge('flex-row gap-[12px] px-[14px] py-[14px] mx-[20px]', className)}>
      <IconTile tint="primary">
        <FeatherIcon size={18} name="user-x" color="primary" />
      </IconTile>
      <Box className="flex-[1] gap-[4px]">
        <Text className="font-bold">{t('auth.sessionExpired.title')}</Text>
        <Text className="text-grey text-[14px]">
          {isConnected ? t('auth.sessionExpired.message') : t('auth.sessionExpired.offlineMessage')}
        </Text>
        {isConnected && (
          <Box className="flex-row mt-[8px]">
            <Button small route="Login">
              {t('auth.sessionExpired.signIn')}
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  )
}

export default SessionExpiredNotice
