import * as React from 'react'
import { Dimensions, ScaledSize } from 'react-native'
import hoistNonReactStatic from 'hoist-non-react-statics'

export const isOrientationLandscape = ({ width, height }) => width > height

export default function withDimensions(WrappedComponent) {
  const { width, height } = Dimensions.get('window')

  class EnhancedComponent extends React.Component {
    state = {
      dimensions: { width, height },
      isLandscape: isOrientationLandscape({ width, height })
    }

    componentDidMount() {
      Dimensions.addEventListener('change', this.handleOrientationChange)
    }

    componentWillUnmount() {
      Dimensions.removeEventListener('change', this.handleOrientationChange)
    }

    handleOrientationChange = ({ window }: { window: ScaledSize }) => {
      const isLandscape = isOrientationLandscape(window)
      this.setState({ isLandscape })
    }

    render() {
      // @ts-ignore
      return <WrappedComponent {...this.props} {...this.state} />
    }
  }

  EnhancedComponent.displayName = `withDimensions(${WrappedComponent.displayName})`
  // @ts-ignore
  return hoistNonReactStatic(EnhancedComponent, WrappedComponent)
}
