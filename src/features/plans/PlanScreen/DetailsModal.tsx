import React from 'react'

import { Sheet, type SheetFooterProps, type SheetRef } from '~common/sheet'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { Image as RNImage } from 'react-native'
import { ComputedPlanItem } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { wp } from '~helpers/utils'

const width = wp(100) - 20 > 600 ? 600 : wp(100) - 20

interface Props extends Omit<ComputedPlanItem, 'status' | 'progress' | 'type' | 'lang'> {
  modalRefDetails: React.RefObject<SheetRef | null>
  header?: React.ReactElement
  footer?: (props: SheetFooterProps) => React.ReactNode
}

const DetailsModal = ({
  modalRefDetails,
  image,
  title,
  downloads,
  description,
  author,
  footer,
  header,
}: Props) => {
  const { t } = useTranslation()
  const [height, setHeight] = React.useState<number>()

  React.useEffect(() => {
    if (!image) return
    RNImage.getSize(
      image,
      (imageWidth, imageHeight) => {
        const height = (width * imageHeight) / imageWidth
        setHeight(height)
      },
      () => {}
    )
  }, [image])

  return (
    <Sheet ref={modalRefDetails} snapPoints={[1]} footer={footer} header={header}>
      <Box paddingHorizontal={20} paddingTop={20} paddingBottom={50}>
        {!!image && (
          <Box marginBottom={20} rounded>
            <Image
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
                <Image
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
    </Sheet>
  )
}

export default DetailsModal
