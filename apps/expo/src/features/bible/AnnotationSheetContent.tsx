import { SheetView } from '~common/sheet'
import { useTranslation } from 'react-i18next'
import AnnotationPreview from './AnnotationPreview'
import {
  AnnotationColorPalette,
  AnnotationTypeButton,
  useAnnotationTools,
  useAnnotationTypeLabels,
  type AnnotationToolbarProps,
} from './AnnotationControls'
import Box, { AnimatedBox, HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { StyleSheet } from 'react-native'
import { LinearTransition } from 'react-native-reanimated'

/**
 * The annotation tools, shown in the selection sheet once words are selected (see
 * BibleSelectionSheet). On desktop, AnnotationMenu shows them beside the verse.
 */
const AnnotationSheetContent = (props: AnnotationToolbarProps) => {
  const {
    hasSelection,
    onEraseAnnotations,
    selectedAnnotation,
    onDeleteAnnotation,
    onNotePress,
    onTagsPress,
    onRelationsPress,
    tagsCount = 0,
    relationsCount = 0,
    annotatedVersion,
  } = props
  const { t } = useTranslation()
  const typeLabels = useAnnotationTypeLabels()
  const {
    disabled,
    noteDisabled,
    tagsDisabled,
    relationsDisabled,
    reference,
    activeAnnotationType,
    setActiveAnnotationType,
    getColor,
    selectedColor,
    apply,
  } = useAnnotationTools(props)

  return (
    <SheetView className="pt-[14px]" testID="annotation-toolbar">
      <HStack className="px-[16px] pb-[14px] items-center gap-[8px]">
        <Box className="flex-1 min-w-0 gap-[4px]">
          <HStack className="items-center gap-[8px]">
            <Text className="font-bold text-[18px] flex-shrink" numberOfLines={1}>
              {t('Annotation')}
            </Text>
            {annotatedVersion && (
              <Box
                className="rounded-full px-[7px] py-[2px] bg-light-grey"
                testID="annotation-toolbar-version"
              >
                <Text className="text-[13px] font-bold text-link">{annotatedVersion}</Text>
              </Box>
            )}
          </HStack>
          <Text className="text-[14px] text-grey" numberOfLines={2}>
            {reference ?? t('Sélectionnez du texte dans la Bible')}
          </Text>
        </Box>
        {(selectedAnnotation || hasSelection) && (
          <Box className="pl-[6px]">
            <TouchableBox
              className="w-[48px] h-[44px] gap-[3px] items-center justify-center rounded-[8px]"
              accessibilityRole="button"
              accessibilityLabel={t('Supprimer')}
              onPress={selectedAnnotation ? onDeleteAnnotation : onEraseAnnotations}
            >
              <FeatherIcon name="trash-2" size={20} color="quart" />
            </TouchableBox>
          </Box>
        )}
      </HStack>

      <AnimatedBox layout={LinearTransition} className="overflow-hidden border-continuous">
        <HStack className="overflow-hidden border-continuous mx-[16px] gap-[8px] items-center">
          {typeLabels.map(({ type, label }) => (
            <AnnotationTypeButton
              key={type}
              disabled={disabled}
              type={type}
              activeType={activeAnnotationType}
              onPress={setActiveAnnotationType}
              label={label}
            >
              <AnnotationPreview type={type} color={getColor(type)} />
            </AnnotationTypeButton>
          ))}
        </HStack>
        <Box className="border-continuous overflow-hidden">
          <AnnotationColorPalette
            type={activeAnnotationType}
            selectedColor={selectedColor}
            onSelectColor={apply}
          />
        </Box>
      </AnimatedBox>
      <HStack
        className="mx-[16px] border-separator py-[12px] items-center"
        style={{ borderTopWidth: StyleSheet.hairlineWidth }}
      >
        <TouchableBox
          className="flex-1 min-w-0 h-[44px] flex-row gap-[6px] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('Note')}
          onPress={onNotePress}
          disabled={noteDisabled}
          accessibilityState={{ disabled: noteDisabled }}
          style={{ opacity: noteDisabled ? 0.35 : 1 }}
        >
          <FeatherIcon
            name={selectedAnnotation?.noteId ? 'file-text' : 'file-plus'}
            size={20}
            color={selectedAnnotation?.noteId ? 'primary' : 'grey'}
          />
          <Text className="text-[13px] text-default" numberOfLines={1}>
            {t('Note')}
          </Text>
        </TouchableBox>
        <Box className="h-[24px] bg-separator" style={{ width: StyleSheet.hairlineWidth }} />
        <TouchableBox
          className="flex-1 min-w-0 h-[44px] flex-row gap-[6px] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={`${t('Étiquettes')}, ${tagsCount}`}
          onPress={onTagsPress}
          disabled={tagsDisabled}
          accessibilityState={{ disabled: tagsDisabled }}
          style={{ opacity: tagsDisabled ? 0.35 : 1 }}
        >
          <FeatherIcon name="tag" size={20} color={tagsCount > 0 ? 'primary' : 'grey'} />
          <Text className="text-[13px] text-default" numberOfLines={1}>
            {t('Étiquettes')}
          </Text>
          {tagsCount > 0 && (
            <Box className="absolute right-0 top-0 bg-primary rounded-full min-w-[14px] h-[14px] px-[2px] items-center justify-center">
              <Text className="text-[8px] text-reverse font-bold">{tagsCount}</Text>
            </Box>
          )}
        </TouchableBox>
        <Box className="h-[24px] bg-separator" style={{ width: StyleSheet.hairlineWidth }} />
        <TouchableBox
          className="flex-1 min-w-0 h-[44px] flex-row gap-[6px] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={`${t('Relations')}, ${relationsCount}`}
          onPress={onRelationsPress}
          disabled={relationsDisabled}
          accessibilityState={{ disabled: relationsDisabled }}
          style={{ opacity: relationsDisabled ? 0.35 : 1 }}
        >
          <FeatherIcon name="git-merge" size={20} color={relationsCount > 0 ? 'primary' : 'grey'} />
          <Text className="text-[13px] text-default" numberOfLines={1}>
            {t('Relations')}
          </Text>
          {relationsCount > 0 && (
            <Box className="absolute right-0 top-0 bg-primary rounded-full min-w-[14px] h-[14px] px-[2px] items-center justify-center">
              <Text className="text-[8px] text-reverse font-bold">{relationsCount}</Text>
            </Box>
          )}
        </TouchableBox>
      </HStack>
    </SheetView>
  )
}

export default AnnotationSheetContent
