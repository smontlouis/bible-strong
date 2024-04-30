import React from 'react'
import FastImage from 'react-native-fast-image'
import { Modalize } from 'react-native-modalize'

import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ComputedPlanItem } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { wp } from '~helpers/utils'
import { Theme } from '~themes'

const width = wp(100) - 20 > 600 ? 600 : wp(100) - 20

interface Props extends Omit<ComputedPlanItem, 'status' | 'progress'> {
  modalRefDetails: React.RefObject<Modalize>
  HeaderComponent?: React.ReactNode
  FooterComponent?: React.ReactNode
}

const DetailsModal = ({
  modalRefDetails,
  image,
  title,
  downloads,
  description,
  author,
  FooterComponent,
  HeaderComponent,
}: Props) => {
  const { t } = useTranslation()
  const theme: Theme = useTheme()
  const [height, setHeight] = React.useState<number>()

  React.useEffect(() => {
    if (!image) return
    Image.getSize(
      image,
      (imageWidth, imageHeight) => {
        const height = (width * imageHeight) / imageWidth
        setHeight(height)
      },
      () => {}
    )
  }, [image])

  return (
    <Modalize
      ref={modalRefDetails}
      modalTopOffset={useSafeAreaInsets().top}
      modalStyle={{
        backgroundColor: theme.colors.lightGrey,
        maxWidth: 600,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
      FooterComponent={FooterComponent}
      HeaderComponent={HeaderComponent}
    >
      <Box paddingHorizontal={20} paddingTop={20} paddingBottom={50}>
        {!!image && (
          <Box marginBottom={20} rounded>
            <FastImage
              style={{ width: '100%', height: height || 200 }}
              source={{
                uri: image,
              }}
            />
          </Box>
        )}
        <Paragraph fontFamily="title" scale={2}>
          {title}
        </Paragraph>
        {!!downloads && (
          <Paragraph fontFamily="text" scale={-2} color="grey">
            {t('Téléchargé {{downloads}} fois', { downloads })}
          </Paragraph>
        )}
        <Paragraph marginTop={20} fontFamily="text" scale={-2}>
          {description}
        </Paragraph>
        {!!author.displayName && (
          <Box marginTop={40} row center>
            {author.photoUrl && (
              <Box borderRadius={10}>
                <FastImage
                  style={{ width: 50, height: 50 }}
                  source={{
                    uri: author.photoUrl,
                  }}
                />
              </Box>
            )}
            <Paragraph marginLeft={10} flex={1} fontFamily="text" scale={-3}>
              {t('Créé par {{displayName}}', {
                displayName: author.displayName,
              })}
            </Paragraph>
          </Box>
        )}
      </Box>
    </Modalize>
  )
}

export default DetailsModal
