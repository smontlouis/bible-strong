import * as React from 'react'
import useDeviceOrientation from './useDeviceOrientation'

const withDeviceOrientation = WrappedComponent => props => {
  const orientation = useDeviceOrientation()
  return <WrappedComponent {...props} orientation={orientation} />
}

export default withDeviceOrientation
