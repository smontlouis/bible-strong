import React from 'react'
import { SheetScrollView, type SheetFooterProps, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { ComputedPlanItem } from '~common/types'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

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
        <Box
          className={
            Platform.OS === 'web'
              ? 'p-[16px]'
              : 'overflow-hidden border-continuous px-[20px] pt-[20px] pb-[32px]'
          }
        >
          {!!image && (
            <Box className="overflow-hidden border-continuous mb-[20px] rounded-[20px]">
              <Image
                contentFit="cover"
                style={{ width: '100%', aspectRatio: 1.8, maxHeight: 240 }}
                source={{
                  uri: image,
                }}
              />
            </Box>
          )}
          <Text className="text-default font-bold text-[22px] leading-[28px]">{title}</Text>
          {!!downloads && (
            <Text className="text-grey text-[13px] mt-[8px]">
              {t('Téléchargé {{downloads}} fois', { downloads })}
            </Text>
          )}
          <Text className="text-default text-[15px] leading-[24px] mt-[20px]">{description}</Text>
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
              <Text className="text-grey text-[13px] leading-[20px] ml-[10px] flex-1">
                {t('Créé par {{displayName}}', {
                  displayName: author.displayName,
                })}
              </Text>
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
