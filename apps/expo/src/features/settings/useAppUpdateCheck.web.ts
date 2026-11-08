import type { AppUpdateCheck } from './useAppUpdateCheck'

export type { AppUpdateCheck }

/** The browser always loads the deployed version: nothing to look for. */
export const useAppUpdateCheck = (): AppUpdateCheck | null => null
