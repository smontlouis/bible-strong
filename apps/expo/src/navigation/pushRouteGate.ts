import { createContext } from 'react'

/**
 * A surface presented above the navigator (a native sheet) provides a gate so that a
 * route pushed from its content waits for the surface to step aside. Without a gate,
 * the push happens immediately.
 */
export const PushRouteGateContext = createContext<(push: () => void) => void>(push => push())
