import React from 'react'
import { FeatherIcon } from '~common/ui/Icon'
import BibleDisplayModeCard from '../BibleDisplayModeCard'
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../../../../test/themeFixture').themeFixture,
}))

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react')
  return {
    Pressable: ({
      children,
      ...props
    }: Record<string, unknown> & {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode)
    }) =>
      ReactModule.createElement(
        'Pressable',
        props,
        typeof children === 'function' ? children({ pressed: false }) : children
      ),
    Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('View', props, children),
  }
})

jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('View', props, children),
  }
})

jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
  }
})

jest.mock('~common/ui/Icon', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react')
  return {
    FeatherIcon: (props: Record<string, unknown>) => ReactModule.createElement('Icon', props),
  }
})

type CardProps = {
  accessibilityLabel?: string
  accessibilityState?: { selected?: boolean; disabled?: boolean }
  children?: React.ReactNode
  disabled?: boolean
  onPress?: () => void
}

type Element = React.ReactElement<{ children?: React.ReactNode; name?: string }>

const renderCard = (props: Partial<Parameters<typeof BibleDisplayModeCard>[0]> = {}) =>
  BibleDisplayModeCard({
    label: 'Strong',
    description: 'Texte + numéros',
    selected: false,
    onPress: jest.fn(),
    children: <span>Aperçu</span>,
    ...props,
  }) as React.ReactElement<CardProps>

/** Every element under the card, depth first. */
const flatten = (node: React.ReactNode): Element[] =>
  React.Children.toArray(node).flatMap(child =>
    React.isValidElement(child)
      ? [child as Element, ...flatten((child as Element).props.children)]
      : []
  )

const texts = (card: React.ReactElement<CardProps>) =>
  flatten(card.props.children)
    .map(element => element.props.children)
    .filter((child): child is string => typeof child === 'string')

describe('BibleDisplayModeCard', () => {
  it('selects its mode when pressed', () => {
    const onPress = jest.fn()
    const card = renderCard({ onPress })

    card.props.onPress?.()

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(card.props.disabled).toBe(false)
  })

  it('marks the selected mode with a check', () => {
    const card = renderCard({ selected: true })
    const icons = flatten(card.props.children).filter(element => element.type === FeatherIcon)

    expect(card.props.accessibilityState).toEqual({ selected: true, disabled: false })
    expect(icons.map(icon => icon.props.name)).toEqual(['check'])
  })

  it('keeps an unavailable mode out of reach and says why', () => {
    const card = renderCard({ unavailable: true, unavailableLabel: 'Connexion requise' })

    expect(card.props.disabled).toBe(true)
    expect(card.props.accessibilityLabel).toBe('Strong. Texte + numéros. Connexion requise')
    expect(texts(card)).toContain('Connexion requise')
  })

  it('offers no download', () => {
    const card = renderCard({ unavailable: true, unavailableLabel: 'Connexion requise' })
    const icons = flatten(card.props.children).filter(element => element.type === FeatherIcon)

    expect(icons.map(icon => icon.props.name)).toEqual(['wifi-off'])
  })
})
