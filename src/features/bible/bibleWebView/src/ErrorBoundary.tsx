import React from 'react'

class ErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error,
      errorInfo,
    })
    // You can also log error messages to an error reporting service here
  }

  render() {
    if (this.state.errorInfo) {
      // Error path
      return <div>Error</div>
    }
    // Normally, just render children
    return this.props.children
  }
}

export default ErrorBoundary
