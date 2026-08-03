import React from 'react'

import BibleStrongReference from '../BibleStrongReference'
import type { CarouselContextValue } from '~helpers/CarouselContext'

jest.mock('@emotion/native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const createStyledComponent = (type: React.ElementType | string) => () =>
    function StyledComponent({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(type as React.ElementType, props, children)
    }
  const styled = Object.assign((type: React.ElementType) => createStyledComponent(type), {
    TouchableOpacity: createStyledComponent('TouchableOpacity'),
    View: createStyledComponent('View'),
  })

  return {
    __esModule: true,
    default: styled,
  }
})

jest.mock('~common/ui/Paragraph', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

describe('BibleStrongReference', () => {
  it.each([
    ['1722', 'dans'],
    ['4352', 'se prosterner devant'],
  ])('selects carousel reference %s from its rendered surface', (reference, word) => {
    const goToCarouselItem = jest.fn()
    const textStyle = { fontSize: 24, lineHeight: 24 }
    const consumer = BibleStrongReference({
      reference,
      word,
      textStyle,
      occurrenceIndex: 2,
    }) as React.ReactElement<{
      children: (value: CarouselContextValue) => React.ReactElement<{
        onPress: () => void
        children: React.ReactElement<{ style?: typeof textStyle }>
      }>
    }>
    const lexicalToken = consumer.props.children({ currentStrongReference: null, goToCarouselItem })
    lexicalToken.props.onPress()

    expect(goToCarouselItem).toHaveBeenCalledWith(reference, 2)
    expect(lexicalToken.props.children.props.style).toEqual(textStyle)
  })

  it('selects only the active occurrence when a Strong reference is repeated', () => {
    const consumer = BibleStrongReference({
      reference: '430',
      word: 'Dieu',
      occurrenceIndex: 1,
    }) as React.ReactElement<{
      children: (value: CarouselContextValue) => React.ReactElement<{ isSelected: boolean }>
    }>

    const lexicalToken = consumer.props.children({
      currentStrongReference: { Code: '430', occurrenceIndex: 0 },
      goToCarouselItem: jest.fn(),
    })

    expect(lexicalToken.props.isSelected).toBe(false)
  })
})
