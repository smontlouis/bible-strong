import StudyOptionsPanel from './StudyOptionsPanel'
import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { Theme, withTheme } from '~themes/ThemeProvider'

import { useTranslation } from 'react-i18next'
import EntityChipList from '~common/EntityChipList'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import { getDateLocale } from '~helpers/languageUtils'
import truncate from '~helpers/truncate'
import useLanguage from '~helpers/useLanguage'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { useMountTime } from '~helpers/useMountTime'
import { Study } from '~redux/modules/user'

export const LinkBox = (
  props: React.ComponentProps<typeof Box> & React.ComponentProps<typeof Link>
) => (
  <Box
    as={Link}
    {...props}
    className={twMerge(
      'overflow-hidden border-continuous',
      twMerge('overflow-hidden border-continuous', props.className)
    )}
  />
)

const StudyLink = (
  componentProps: Omit<UIComponentProps<typeof Link>, keyof { theme: Theme } | 'theme'> &
    Omit<{ theme: Theme }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('relative flex-col flex-[1]', className))
  return (
    <Link
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

export type StudyItemProps = {
  columns?: number
  study: Study
  theme: Theme
  setStudySettings?: (studyId: string) => void
  onPress?: (studyId: string) => void
  relationCount?: number
  onRelationPress?: () => void
}

const StudyItem = ({
  study,
  columns,
  theme,
  setStudySettings,
  onPress,
  relationCount,
  onRelationPress,
}: StudyItemProps) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const mountTime = useMountTime()

  const formattedDate = distanceInWords(Number(study.modified_at), mountTime, {
    locale: getDateLocale(lang),
  })
  const r = useMediaQueriesArray()

  return (
    <Box
      className="overflow-hidden border-continuous"
      style={{ width: columns ? `${100 / columns}%` : r(['50%', '50%', '33%', '33%']) }}
    >
      <Box
        className="overflow-hidden border-continuous m-[10px] bg-reverse p-[10px] h-[230px] rounded-[8px] relative"
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <StudyLink
          {...(onPress
            ? { onPress: () => onPress(study.id) }
            : {
                route: 'EditStudy',
                params: { studyId: study.id },
              })}
        >
          <Text className="text-dark-grey text-[10px] mt-[10px]">
            {t('Il y a {{formattedDate}}', { formattedDate })}
          </Text>
          {study.content ? (
            <>
              <Text className="font-bold text-[16px] mt-[4px]">{study.title}</Text>

              <Paragraph className="mt-[10px]" scale={-3}>
                {truncate(
                  deltaToPlainText(
                    study.content.ops as unknown as Parameters<typeof deltaToPlainText>[0]
                  ),
                  80
                )}
              </Paragraph>
            </>
          ) : (
            <>
              <Text className="font-bold text-[16px] mt-[4px] text-border">{t('Étude vide')}</Text>
            </>
          )}
        </StudyLink>
        <Box className="overflow-hidden border-continuous mt-auto">
          <EntityChipList
            limit={1}
            tags={study.tags}
            relationCount={relationCount}
            onRelationPress={onRelationPress}
          />
        </Box>
        {!!setStudySettings && (
          <Box className="absolute top-0 right-0">
            <StudyOptionsPanel study={study} />
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default withTheme(StudyItem)
