import distanceInWords from 'date-fns/formatDistance'
import enGB from 'date-fns/locale/en-GB'
import fr from 'date-fns/locale/fr'
import React from 'react'

import { shallowEqual, useSelector } from 'react-redux'

import { useTranslation } from 'react-i18next'
import { ChangelogTag } from '~common/Changelog'
import Header from '~common/Header'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'

const Changelog = () => {
  const changelog = useSelector((state: RootState) => state.user.changelog.data, shallowEqual)
  const { t } = useTranslation()
  const isFR = useLanguage()

  // @ts-ignore
  changelog.sort((a, b) => b.date - a.date)

  return (
    <Container>
      <Header hasBackButton title="Changelog" />
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
            {changelog.map(log => {
              const formattedDate = distanceInWords(Number(log.date), Date.now(), {
                locale: isFR ? fr : enGB,
              })
              return (
                <Box key={log.date} marginTop={10} marginBottom={10}>
                  <Box row alignItems="flex-start">
                    <Text fontSize={16} bold flex>
                      {log.title}
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
                  <Text marginTop={10}>{log.description}</Text>
                </Box>
              )
            })}
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default Changelog
