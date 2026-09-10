import * as Icon from '~common/ui/classNameIcons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { twMerge } from '~common/ui/classNames'

import Header from '~common/Header'
import Link, { LinkProps } from '~common/Link'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { MainStackProps } from '~navigation/type'
import type { Theme as AppTheme } from '~themes'

const LinkItem = (
  componentProps: Omit<
    UIComponentProps<typeof Link>,
    keyof LinkProps<keyof MainStackProps> | 'theme'
  > &
    Omit<LinkProps<keyof MainStackProps>, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-row items-center px-[20px] py-[15px]', className)
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

const StyledIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-grey mr-[15px]', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

const BackupScreen = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header hasBackButton title={t('backup.title')} />
      <ScrollView style={{ flex: 1 }}>
        <LinkItem route="ImportExport">
          <StyledIcon name="upload" size={25} />
          <Text className="text-[15px]">{t('app.importexport')}</Text>
        </LinkItem>
        <LinkItem route="AutomaticBackups">
          <StyledIcon name="save" size={25} />
          <Text className="text-[15px]">{t('backups.title')}</Text>
        </LinkItem>
      </ScrollView>
    </Container>
  )
}

export default BackupScreen
