import React from 'react'
import { SheetScrollView, type SheetFooterProps, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { Image as RNImage, Platform } from 'react-native'
import { ComputedPlanItem } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { wp } from '~helpers/utils'
const width = wp(100) - 20 > 600 ? 600 : wp(100) - 20

interface Props extends Omit<ComputedPlanItem, 'status' | 'progress' | 'type' | 'lang'> {
  modalRefDetails?: React.RefObject<SheetRef | null>
  inline?: boolean
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
  inline = false,
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

  const Container = inline ? InlineDetails : Sheet
  return (
    <Container
      ref={modalRefDetails}
      panelTitle={t('Détails')}
      panelWidth={500}
      snapPoints={[1]}
      footer={footer}
      header={header}
    >
      <SheetScrollView>
        {/** TODO: fix */}
        <Box
          className={
            Platform.OS === 'web'
              ? 'p-[16px]'
              : 'overflow-hidden border-continuous px-[20px] pt-[20px] pb-[200px]'
          }
        >
          {!!image && (
            <Box className="overflow-hidden border-continuous mb-[20px] rounded-[20px]">
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
            <Paragraph className="text-grey" fontFamily="text" scale={-2}>
              {t('Téléchargé {{downloads}} fois', { downloads })}
            </Paragraph>
          )}
          <Paragraph className="mt-[20px]" fontFamily="text" scale={-2}>
            {description}
          </Paragraph>
          {!!author.displayName && (
            <Box className="overflow-hidden border-continuous mt-[40px] flex-row items-center justify-center">
              {author.photoUrl && (
                <Box className="overflow-hidden border-continuous rounded-[10px]">
                  <Image
                    style={{ width: 50, height: 50 }}
                    source={{
                      uri: author.photoUrl,
                    }}
                  />
                </Box>
              )}
              <Paragraph className="ml-[10px] flex-[1]" fontFamily="text" scale={-3}>
                {t('Créé par {{displayName}}', {
                  displayName: author.displayName,
                })}
              </Paragraph>
            </Box>
          )}
        </Box>
      </SheetScrollView>
    </Container>
  )
}

export default DetailsModal

const InlineDetails = ({
  children,
}: import('~common/ContextualPanel/ContextualSheet').ContextualSheetProps) => <>{children}</>
