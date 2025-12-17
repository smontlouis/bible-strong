import React from 'react'
import { ScrollView } from 'react-native'
import Modal from 'react-native-modalbox'
import distanceInWords from 'date-fns/formatDistance'
import fr from 'date-fns/locale/fr'
import enGB from 'date-fns/locale/en-GB'

import { useSelector, useDispatch, shallowEqual } from 'react-redux'

import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import { logTypes } from '~helpers/changelog'
import { saveAllLogsAsSeen } from '~redux/modules/user'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'
import styled from '@emotion/native'
import { RootState } from '~redux/modules/reducer'
import { ChangelogItem, LogType } from './types'

// @ts-ignore
const StylizedModal = styled(Modal)(({ theme }) => ({
  height: 400,
  width: '80%',
  maxWidth: 500,
  minWidth: 300,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
}))

const getTagColor = (type: LogType) => {
  switch (type) {
    case logTypes.BUG: {
      return '#e74c3c'
    }
    case logTypes.FEATURE: {
      return '#3498db'
    }
    case logTypes.NEW: {
      return '#2ecc71'
    }
    case logTypes.INFO: {
      return '#2c3e50'
    }
    default:
      return '#2c3e50'
  }
}

export const ChangelogTag = styled.View(({ type }: { type: LogType }) => ({
  marginLeft: 10,
  padding: 3,
  backgroundColor: getTagColor(type),
  borderRadius: 3,
}))

const hasNewLogs = (seenLogs: string[], changelog: ChangelogItem[]) => {
  if (!changelog.length) {
    return false
  }

  if (!seenLogs.length) {
    return true
  }

  const newLogs = findNewLogs(seenLogs, changelog)
  return !!newLogs.length
}

const findNewLogs = (seenLogs: string[], changeLog: ChangelogItem[]) =>
  changeLog.filter(log => !seenLogs.find(c => c === log.date))

const Changelog = () => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const isFR = useLanguage()
  const seenLogs = useSelector(
    (state: RootState) => Object.keys(state.user.bible.changelog),
    shallowEqual
  )
  const changelog = useSelector((state: RootState) => state.user.changelog.data, shallowEqual)
  const changelogIsLoading = useSelector((state: RootState) => state.user.changelog.isLoading)

  const getAttribute = (log: ChangelogItem, attr: keyof ChangelogItem) => {
    if (isFR) {
      return log[attr]
    }

    return log[`${attr}_en` as keyof ChangelogItem] || log[attr]
  }

  if (!changelogIsLoading && hasNewLogs(seenLogs, changelog)) {
    const newLogs = findNewLogs(seenLogs, changelog)

    return (
      // @ts-ignore
      <StylizedModal
        isOpen
        onClosed={() => {}}
        animationDuration={200}
        position="center"
        backdropOpacity={0.3}
        backdropPressToClose={false}
        swipeToClose={false}
      >
        <ScrollView style={{ flex: 1 }}>
          <Box padding={20}>
            <Text fontSize={30} bold>
              {t('Quoi de neuf ?')}
            </Text>
            <Text marginTop={5} fontSize={12} color="grey">
              {t('Les changements depuis votre dernière visite')}
            </Text>
            <Border marginTop={15} />
            <Box marginTop={10}>
              {newLogs.map(log => {
                const formattedDate = distanceInWords(Number(log.date), Date.now(), {
                  locale: isFR ? fr : enGB,
                })
                return (
                  <Box key={log.date} marginTop={10} marginBottom={10}>
                    <Box row alignItems="flex-start">
                      <Text fontSize={16} bold flex>
                        {getAttribute(log, 'title')}
                      </Text>
                      <ChangelogTag type={log.type}>
                        <Text fontSize={11} bold color="reverse">
                          {log.type}
                        </Text>
                      </ChangelogTag>
                    </Box>
                    <Text fontSize={10} color="grey">
                      {t('Il y a {{formattedDate}}', { formattedDate })}
                    </Text>
                    <Text marginTop={10}>{getAttribute(log, 'description')}</Text>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </ScrollView>
        <Box padding={20} alignItems="flex-end">
          <Button onPress={() => dispatch(saveAllLogsAsSeen(changelog))} small>
            {t('Fermer')}
          </Button>
        </Box>
      </StylizedModal>
    )
  }

  return null
}

export default Changelog
