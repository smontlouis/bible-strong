import React from 'react'

import BibleDisplayModeCard from '../BibleDisplayModeCard'

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

jest.mock('~common/ui/Progress', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactModule.createElement('Progress', props),
  }
})

type CardPressableProps = {
  accessibilityLabel?: string
  children?: React.ReactNode
  disabled?: boolean
  onPress?: () => void
}

const getCardPressable = (
  card: React.ReactElement<{ children: React.ReactNode }>
): React.ReactElement<CardPressableProps> =>
  React.Children.only(card.props.children) as React.ReactElement<CardPressableProps>

describe('BibleDisplayModeCard', () => {
  it('uses the whole unavailable card to request its download', () => {
    const onPress = jest.fn()
    const onDownloadPress = jest.fn()
    const pressable = getCardPressable(
      BibleDisplayModeCard({
        label: 'Strong',
        description: 'Texte + numéros',
        selected: false,
        onPress,
        downloadRequired: true,
        downloadAccessibilityLabel: 'Télécharger les ressources pour Strong',
        onDownloadPress,
        children: <span>Aperçu</span>,
      })
    )

    expect(pressable.props.accessibilityLabel).toBe('Télécharger les ressources pour Strong')
    expect(pressable.props.disabled).toBe(false)

    pressable.props.onPress?.()

    expect(onDownloadPress).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('selects an installed mode when its card is pressed', () => {
    const onPress = jest.fn()
    const onDownloadPress = jest.fn()
    const pressable = getCardPressable(
      BibleDisplayModeCard({
        label: 'Strong',
        description: 'Texte + numéros',
        selected: false,
        onPress,
        onDownloadPress,
        children: <span>Aperçu</span>,
      })
    )

    pressable.props.onPress?.()

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onDownloadPress).not.toHaveBeenCalled()
  })

  it('temporarily disables the whole card while preparing its download', () => {
    const card = BibleDisplayModeCard({
      label: 'Strong',
      description: 'Texte + numéros',
      selected: false,
      onPress: jest.fn(),
      downloadRequired: true,
      downloading: true,
      downloadProgress: 0.42,
      onDownloadPress: jest.fn(),
      children: <span>Aperçu</span>,
    })
    const pressable = getCardPressable(card)
    const content = pressable.props.children as React.ReactElement<{ children: React.ReactNode }>
    const downloadIndicator = React.Children.toArray(content.props.children).at(
      -1
    ) as React.ReactElement<{ children: React.ReactElement<{ progress: number }> }>

    expect(pressable.props.disabled).toBe(true)
    expect(downloadIndicator.props.children.props.progress).toBe(0.42)
  })
})
