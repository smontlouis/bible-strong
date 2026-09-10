import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme as useAppTheme } from '~themes/ThemeProvider'
import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { Linking } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'

import Header from '~common/Header'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { Theme } from '~themes'

const LinkItem = (
  componentProps: Omit<UIComponentProps<typeof Link>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'flex-row items-center px-[20px] py-[15px] border-b-[1px] border-b-border',
    className
  )
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

const StyledIcon = (
  componentProps: Omit<
    UIComponentProps<typeof Icon.Feather>,
    keyof { color?: keyof Theme['colors'] } | 'theme'
  > &
    Omit<{ color?: keyof Theme['colors'] }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const resolvedClassName = twMerge('ml-auto mr-[15px]', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={
        [
          { color: color ? theme.colors[color] : theme.colors.grey },
          props.style,
        ] as UIComponentProps<typeof Icon.Feather>['style']
      }
    />
  )
}

const LoginScreen = () => {
  const stylingTheme = useStylingTheme()

  return (
    <Container>
      <Header hasBackButton title="Soutenir le développeur" />
      <ScrollView>
        <Box className="overflow-hidden border-continuous p-[20px]">
          <Text
            className="text-[30px] mb-[30px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            Hello !
          </Text>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Avant toute chose, merci d'envisager de m'aider.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Plus vous êtes nombreux, plus le coût des serveurs augmente. L'application est
            développée sur mon temps libre et est totalement gratuite. Dieu m'a donné un don, et
            c'est un plaisir pour moi de l'utiliser à sa gloire.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Si vous souhaitez me soutenir, vous pouvez le faire de deux façons. Soit par{' '}
            <Paragraph
              className="text-primary font-bold"
              onPress={() => Linking.openURL('https://fr.tipeee.com/smontlouis')}
            >
              Tipeee,
            </Paragraph>{' '}
            ou par{' '}
            <Paragraph
              className="text-primary font-bold"
              onPress={() => Linking.openURL('https://www.paypal.me/smontlouis')}
            >
              Paypal
            </Paragraph>
            .
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Tipeee vous permet de soutenir en une fois ou mensuellement. Lorsque vous soutenez
            quelqu'un mensuellement, vous pouvez donner 1€ par mois par exemple.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Juste 1€ par mois ! Et comme dit le proverbe martiniquais :{' '}
            <Paragraph className="text-quart">"Sé grèn diri ka fè sak diri."</Paragraph>, "Ce sont
            les grains de riz qui font les sacs de riz.", autrement dit, l’accumulation de petites
            choses font de grandes choses.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Vous trouverez plus d'informations sur mon parcours et ma motivation sur ma page Tipeee.
          </Paragraph>
          <Paragraph className="mb-[20px]" scaleLineHeight={-1}>
            Merci de m'avoir lu et bonne étude !
          </Paragraph>
          <LinkItem href="https://fr.tipeee.com/smontlouis">
            <Text className="font-bold text-[16px]">Lien Tipeee</Text>
            <StyledIcon name="arrow-right" size={25} />
          </LinkItem>
          <LinkItem href="https://www.paypal.me/smontlouis">
            <Text className="font-bold text-[16px]">Lien paypal</Text>
            <StyledIcon name="arrow-right" size={25} />
          </LinkItem>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default LoginScreen
