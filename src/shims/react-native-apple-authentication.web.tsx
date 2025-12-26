import React from 'react'
import { ViewStyle } from 'react-native'

// Web shim for @invertase/react-native-apple-authentication
// Apple Sign-In via native SDK is not available on web

interface AppleButtonProps {
  style?: ViewStyle
  buttonStyle?: number
  buttonType?: number
  onPress?: () => void
}

// Render nothing on web since Apple Sign-In native SDK is not available
const AppleButtonComponent = (_props: AppleButtonProps) => {
  return null
}

// Add static properties to match the library's API
AppleButtonComponent.Style = {
  WHITE: 0,
  WHITE_OUTLINE: 1,
  BLACK: 2,
} as const

AppleButtonComponent.Type = {
  SIGN_IN: 0,
  CONTINUE: 1,
  SIGN_UP: 2,
} as const

export { AppleButtonComponent as AppleButton }

const appleAuth = {
  // Apple Sign-In is not supported on web via native SDK
  isSupported: false,
  isSignUpButtonSupported: false,

  // Operation constants
  Operation: {
    LOGIN: 0,
    LOGOUT: 1,
    IMPLICIT: 2,
    REFRESH: 3,
  },

  // Scope constants
  Scope: {
    EMAIL: 0,
    FULL_NAME: 1,
  },

  // Stub methods that return rejected promises
  performRequest: async () => {
    throw new Error('Apple Sign-In is not supported on web')
  },

  getCredentialStateForUser: async () => {
    throw new Error('Apple Sign-In is not supported on web')
  },
}

export default appleAuth
