import React, { useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'

import { wp } from '~helpers/utils'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import loadNaveByRandom from '~helpers/loadNaveByRandom'
import waitForNaveWidget from './waitForNaveWidget'

const itemHeight = 130
const itemWidth = wp(60)

const NaveOfTheDay = ({ color1 = 'rgb(80, 83, 140)', color2 = 'rgb(48, 51, 107)' }) => {
  const [error, setError] = useState(false)
  const [naveReference, setNaveRef] = useState(null)
  useEffect(() => {
    const loadNave = async () => {
      const naveReference = await loadNaveByRandom()
      if (naveReference.error) {
        setError(naveReference.error)
        return
      }

      setNaveRef(naveReference)
    }
    loadNave()
  }, [])

  if (error) {
    return (
      <Box center shadow height={itemHeight} padding={30} marginRight={20}>
        <FeatherIcon name="x" size={30} color="quart" />
        <Text marginTop={5}>Une erreur est survenue.</Text>
      </Box>
    )
  }

  if (!naveReference) {
    return (
      <Box height={itemHeight} center marginRight={20}>
        <Text>Chargement...</Text>
      </Box>
    )
  }

  const { name, name_lower } = naveReference

  return (
    <Link route="NaveDetail" params={{ name, name_lower }}>
      <Box center rounded height={itemHeight} width={itemWidth} marginRight={20}>
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: itemHeight,
            borderRadius: 3
          }}>
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: itemHeight }}
            colors={[color1, color2]}
          />
        </Box>
        <Box backgroundColor="rgba(0,0,0,0.1)" paddingHorizontal={5} paddingVertical={3} rounded>
          <Text fontSize={10} style={{ color: 'white' }}>
            Thème
          </Text>
        </Box>
        <Paragraph style={{ color: 'white' }} scale={1} scaleLineHeight={-2}>
          {name}
        </Paragraph>
      </Box>
    </Link>
  )
}

export default waitForNaveWidget(NaveOfTheDay)
