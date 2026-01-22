/**
 * Route mapping utility for migration from React Navigation to Expo Router
 * Maps old screen names to new Expo Router paths
 */

import { MainStackProps } from './type'

/**
 * Maps React Navigation screen names to Expo Router paths
 */
export const routeMapping: Record<keyof MainStackProps, string> = {
  AppSwitcher: '/',
  More: '/more',
  Home: '/home',
  Profile: '/profile',
  BibleSelect: '/bible-select',
  VersionSelector: '/version-selector',
  BibleVerseDetail: '/bible-verse-detail',
  BibleVerseNotes: '/bible-verse-notes',
  BibleVerseLinks: '/bible-verse-links',
  Highlights: '/highlights',
  Strong: '/strong',
  DictionnaireVerseDetail: '/dictionnaire-verse-detail',
  ConcordanceByBook: '/concordance-by-book',
  BibleView: '/bible-view',
  BibleCompareVerses: '/bible-compare-verses',
  Studies: '/studies',
  Lexique: '/lexique',
  EditStudy: '/edit-study',
  DictionnaryDetail: '/dictionnary-detail',
  Login: '/login',
  Support: '/support',
  Changelog: '/changelog',
  ImportExport: '/import-export',
  Backup: '/backup',
  AutomaticBackups: '/automatic-backups',
  Pericope: '/pericope',
  History: '/history',
  Tags: '/tags',
  Bookmarks: '/bookmarks',
  Tag: '/tag',
  Downloads: '/downloads',
  Search: '/search',
  LocalSearch: '/local-search',
  Register: '/register',
  ForgotPassword: '/forgot-password',
  Dictionnaire: '/dictionnaire',
  FAQ: '/faq',
  Nave: '/nave',
  NaveDetail: '/nave-detail',
  NaveWarning: '/nave-warning',
  ToggleCompareVerses: '/toggle-compare-verses',
  Plan: '/plan',
  Plans: '/plans',
  MyPlanList: '/my-plan-list',
  PlanSlice: '/plan-slice',
  Timeline: '/timeline',
  TimelineHome: '/timeline-home',
  Concordance: '/concordance',
  Commentaries: '/commentaries',
  BibleShareOptions: '/bible-share-options',
  ResourceLanguage: '/resource-language',
  BibleDefaults: '/bible-defaults',
  Theme: '/theme',
  WordAnnotations: '/word-annotations',
}

/**
 * Gets the Expo Router path for a given screen name
 */
export function getRoutePath<T extends keyof MainStackProps>(screenName: T): string {
  return routeMapping[screenName]
}

/**
 * Gets the screen name from an Expo Router path
 */
export function getScreenName(path: string): keyof MainStackProps | undefined {
  const entries = Object.entries(routeMapping)
  const found = entries.find(([_, routePath]) => routePath === path)
  return found ? (found[0] as keyof MainStackProps) : undefined
}

/**
 * Type-safe navigation helper that converts screen name and params to Expo Router format
 */
export function toExpoRoute<T extends keyof MainStackProps>(
  screenName: T,
  params?: MainStackProps[T]
): { pathname: string; params?: MainStackProps[T] } {
  return {
    pathname: routeMapping[screenName],
    params,
  }
}
