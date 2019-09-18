import React from 'react'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'

class ErrorBoundary extends React.Component {
  state = { error: null, hasError: false }

  static getDerivedStateFromError(error) {
    return { error, hasError: true }
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') {
      this.props.onError.call(this, error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      // Error path
      return (
        <Container>
          <Text>Error: {this.state.error}</Text>
        </Container>
      )
    }
    // Normally, just render children
    return this.props.children
  }
}

export default ErrorBoundary
