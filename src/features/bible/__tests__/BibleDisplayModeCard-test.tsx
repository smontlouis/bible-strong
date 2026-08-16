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

const getCardPressables = (
  card: React.ReactElement<{ children: React.ReactNode }>
): React.ReactElement<CardPressableProps>[] =>
  React.Children.toArray(card.props.children) as React.ReactElement<CardPressableProps>[]

describe('BibleDisplayModeCard', () => {
  it('keeps selection and Offline acquisition as separate actions', () => {
    const onPress = jest.fn()
    const onDownloadPress = jest.fn()
    const [selectionPressable, downloadPressable] = getCardPressables(
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

    expect(selectionPressable!.props.accessibilityLabel).toBe('Strong. Texte + numéros')
    expect(downloadPressable!.props.accessibilityLabel).toBe(
      'Télécharger les ressources pour Strong'
    )
    expect(selectionPressable!.props.disabled).toBe(true)

    if (!selectionPressable!.props.disabled) selectionPressable!.props.onPress?.()
    downloadPressable!.props.onPress?.()

    expect(onDownloadPress).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('selects an installed mode when its card is pressed', () => {
    const onPress = jest.fn()
    const onDownloadPress = jest.fn()
    const [pressable] = getCardPressables(
      BibleDisplayModeCard({
        label: 'Strong',
        description: 'Texte + numéros',
        selected: false,
        onPress,
        onDownloadPress,
        children: <span>Aperçu</span>,
      })
    )

    pressable!.props.onPress?.()

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
    const [pressable, downloadPressable] = getCardPressables(card)
    const content = pressable!.props.children as React.ReactElement<{ children: React.ReactNode }>
    const downloadIndicator = React.Children.toArray(content.props.children).at(
      -1
    ) as React.ReactElement<{ children: React.ReactElement<{ progress: number }> }>

    expect(pressable!.props.disabled).toBe(true)
    expect(downloadPressable!.props.disabled).toBe(true)
    expect(downloadIndicator.props.children.props.progress).toBe(0.42)
  })

  it('disables Offline acquisition while keeping its intent visible', () => {
    const [selectionPressable, downloadPressable] = getCardPressables(
      BibleDisplayModeCard({
        label: 'Strong',
        description: 'Texte + numéros',
        selected: false,
        onPress: jest.fn(),
        downloadRequired: true,
        downloadDisabled: true,
        downloadAccessibilityLabel: 'Reconnectez-vous pour télécharger Strong',
        onDownloadPress: jest.fn(),
        children: <span>Aperçu</span>,
      })
    )

    expect(selectionPressable!.props.disabled).toBe(true)
    expect(downloadPressable!.props.disabled).toBe(true)
  })

  it('keeps progress in place of the list radio while a confirmed download is active', () => {
    const card = BibleDisplayModeCard({
      layout: 'list',
      label: 'Strong',
      description: 'Texte + numéros',
      selected: false,
      onPress: jest.fn(),
      downloadRequired: false,
      downloading: true,
      downloadProgress: 0.42,
      onDownloadPress: jest.fn(),
      children: <span>Aperçu</span>,
    })
    const [pressable] = getCardPressables(card)
    const content = pressable!.props.children as React.ReactElement<{ children: React.ReactNode }>
    const downloadIndicator = React.Children.toArray(content.props.children).at(
      0
    ) as React.ReactElement<{ children: React.ReactElement<{ progress?: number }> }>

    expect(downloadIndicator.props.children.props.progress).toBe(0.42)
  })
})
