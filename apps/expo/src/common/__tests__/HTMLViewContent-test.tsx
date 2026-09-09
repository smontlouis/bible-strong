import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import HTMLViewContent from '../HTMLViewContent'
import SwitchableHTMLView from '../SwitchableHTMLView'

jest.mock('../SwitchableHTMLView', () => ({ __esModule: true, default: 'Reader' }))

it('routes Nave and legacy editorial callers through the common reader without forcing an engine', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const onLinkClicked = jest.fn()
  let view!: ReactTestRenderer
  act(() => {
    view = create(<HTMLViewContent html="<p>Aaron</p>" onLinkClicked={onLinkClicked} />)
  })
  const reader = view.root.findByType(SwitchableHTMLView)
  expect(reader.props).toMatchObject({ value: '<p>Aaron</p>', padded: true, onLinkClicked })
  expect(reader.props.engine).toBeUndefined()
  act(() => view.unmount())
})
