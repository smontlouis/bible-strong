import React from 'react'
import BibleStrongReference from '../BibleStrongReference'
import type { StrongResourceScrollValue } from '../StrongResourceScrollContext'
jest.mock('react-native', () => ({
  Text: 'Text',
  View: 'View',
  TouchableOpacity: 'TouchableOpacity',
}))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }))
// Behavioral tests do not run Metro's generated Uniwind stylesheet.
jest.mock('uniwind', () => ({ withUniwind: (component: unknown) => component }))

jest.mock('~common/ui/Paragraph', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

describe('BibleStrongReference', () => {
  it.each([
    ['1722', 'dans'],
    ['4352', 'se prosterner devant'],
  ])('selects Strong card %s from its rendered surface', (reference, word) => {
    const scrollToStrongCard = jest.fn()
    const registerStrongWordLayout = jest.fn()
    const textStyle = { fontSize: 24, lineHeight: 24 }
    const consumer = BibleStrongReference({
      reference,
      word,
      textStyle,
      occurrenceIndex: 2,
    }) as React.ReactElement<{
      children: (value: StrongResourceScrollValue) => React.ReactElement<{
        onPress: () => void
        onLayout: (event: { nativeEvent: { layout: { y: number } } }) => void
        children: React.ReactElement<{ style?: typeof textStyle }>
      }>
    }>
    const lexicalToken = consumer.props.children({
      currentTarget: null,
      registerStrongWordLayout,
      scrollToStrongCard,
    })
    lexicalToken.props.onPress()
    lexicalToken.props.onLayout({ nativeEvent: { layout: { y: 120 } } })

    expect(scrollToStrongCard).toHaveBeenCalledWith(reference, 2)
    expect(registerStrongWordLayout).toHaveBeenCalledWith(2, 120)
    expect(lexicalToken.props.children.props.style).toEqual(textStyle)
  })

  it('selects only the active occurrence when a Strong reference is repeated', () => {
    const consumer = BibleStrongReference({
      reference: '430',
      word: 'Dieu',
      occurrenceIndex: 1,
    }) as React.ReactElement<{
      children: (value: StrongResourceScrollValue) => React.ReactElement<{ isSelected: boolean }>
    }>

    const lexicalToken = consumer.props.children({
      currentTarget: { code: '430', occurrenceIndex: 0 },
      registerStrongWordLayout: jest.fn(),
      scrollToStrongCard: jest.fn(),
    })

    expect(lexicalToken.props.isSelected).toBe(false)
  })
})
