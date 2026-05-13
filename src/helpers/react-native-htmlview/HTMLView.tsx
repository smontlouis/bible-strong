import React from 'react'
import { Linking, StyleSheet, Text } from 'react-native'
import htmlToElement from './htmlToElement'

interface HTMLViewProps {
  value?: string
  onLinkPress?: (...args: any[]) => void
  onError?: (err: any) => void
  stylesheet?: Record<string, any>
  renderNode?: (...args: any[]) => any
}

interface HTMLViewState {
  element: React.ReactNode | null
}

class HTMLView extends React.Component<HTMLViewProps, HTMLViewState> {
  static defaultProps = {
    onLinkPress: Linking.openURL,
    onError: console.error.bind(console),
  }

  state: HTMLViewState = {
    element: null,
  }

  UNSAFE_componentWillReceiveProps(nextProps: HTMLViewProps) {
    if (this.props.value !== nextProps.value) {
      this.startHtmlRender(nextProps.value)
    }
  }

  componentDidMount() {
    this.startHtmlRender(this.props.value)
  }

  startHtmlRender = (value?: string) => {
    if (!value) return this.setState({ element: null })

    const opts = {
      linkHandler: this.props.onLinkPress,
      styles: { ...baseStyles, ...this.props.stylesheet },
      customRenderer: this.props.renderNode,
    }

    htmlToElement(value, opts, (err: any, element: React.ReactNode) => {
      if (err) return this.props.onError?.(err)
      this.setState({ element })
    })
  }

  render() {
    if (this.state.element) {
      return <Text>{this.state.element}</Text>
    }
    return <Text />
  }
}

const boldStyle = { fontWeight: '500' as const }
const italicStyle = { fontStyle: 'italic' as const }
const codeStyle = { fontFamily: 'Menlo' }

const baseStyles = StyleSheet.create({
  b: boldStyle,
  strong: boldStyle,
  i: italicStyle,
  em: italicStyle,
  pre: codeStyle,
  code: codeStyle,
  a: {
    fontWeight: '500',
    color: '#007AFF',
  },
})

export default HTMLView
