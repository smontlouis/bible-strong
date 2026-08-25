import { Link } from '@chakra-ui/next-js'
import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import NextLink from 'next/link'

import { FaGithub } from 'react-icons/fa'
import { useI18n, useCurrentLocale } from '../locales'
import Logo from '../public/images/svg/logo-full.svg'

export default function Home() {
  const t = useI18n()
  const locale = useCurrentLocale()

  return (
    <Flex
      p="m"
      height="100vh"
      alignItems="center"
      justifyContent="center"
      flexDir="column"
      backgroundImage={{ base: 'none', md: "url('/images/background.jpg')" }}
      style={{
        backgroundSize: 'contain',
        backgroundPosition: 'right',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Box as={Logo} width="240px" pos="absolute" top={0} left="20px" />
      <Box>
        <Text fontSize={60} variant="bold">
          {t('home.all')}.
          <br />
          {t('home.inOne')}.
        </Text>
        <Text mt="l" maxW="400px">
          {t('home.description')}
        </Text>
        <Flex alignItems="center" mt="l">
          <Box
            as="a"
            width={160}
            height="50px"
            href="https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8"
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              background: `url(https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/${
                locale === 'fr' ? 'fr-fr' : 'en-US'
              }?size=250x83&amp;releaseDate=1562112000) no-repeat`,
              backgroundSize: 'contain',
            }}
          />
          <Box
            width={locale === 'fr' ? 165 : 180}
            height={locale === 'fr' ? 63 : 70}
            as="a"
            href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong&pcampaignid=MKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1"
          >
            <img
              alt="Disponible sur Google Play"
              src={`https://play.google.com/intl/en_us/badges/images/generic/${locale}_badge_web_generic.png`}
              width={locale === 'fr' ? 165 : 180}
              style={{ marginBottom: 0 }}
            />
          </Box>
        </Flex>
      </Box>
      <HStack
        spacing="m"
        pos="absolute"
        bottom={0}
        left="50%"
        transform="translate(-50%)"
        p="m"
      >
        <Link as={NextLink} href="/give" color="grey">
          {t('support')}
        </Link>
        <Link
          href="https://github.com/smontlouis/bible-strong"
          color="grey"
          isExternal
        >
          <FaGithub style={{ display: 'inline-block' }} /> Github
        </Link>
      </HStack>
    </Flex>
  )
}
