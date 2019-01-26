import React from 'react'
import htmlToElement from './htmlToElement'
import { Linking, StyleSheet, Text } from 'react-native'

class HTMLView extends React.Component {
  static defaultProps = {
    onLinkPress: Linking.openURL,
    onError: console.error.bind(console)
  }

  state = {
    element: null
  }

  componentWillReceiveProps (nextProps) {
    if (this.props.value !== nextProps.value) {
      this.startHtmlRender(nextProps.value)
    }
  }

  componentDidMount () {
    this.startHtmlRender(this.props.value)
  }

  startHtmlRender = value => {
    if (!value) return this.setState({ element: null })

    var opts = {
      linkHandler: this.props.onLinkPress,
      styles: Object.assign({}, baseStyles, this.props.stylesheet),
      customRenderer: this.props.renderNode
    }

    htmlToElement(value, opts, (err, element) => {
      if (err) return this.props.onError(err)
      this.setState({ element })
    })
  }

  render () {
    if (this.state.element) {
      return <Text children={this.state.element} />
    }
    return <Text />
  }
}

const boldStyle = { fontWeight: '500' }
const italicStyle = { fontStyle: 'italic' }
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
    color: '#007AFF'
  }
})

export default HTMLView
