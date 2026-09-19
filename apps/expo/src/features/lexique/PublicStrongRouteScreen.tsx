import { Redirect, type Href, useLocalSearchParams } from 'expo-router'

import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { IS_FORM_SHEET } from '~helpers/constants'
import StrongConcordanceRouteScreen from './StrongConcordanceRouteScreen'
import StrongDictionaryRouteScreen from './StrongDictionaryRouteScreen'
import StrongEntityRouteScreen from './StrongEntityRouteScreen'
import StrongMainScreen from './StrongMainScreen'
import StrongRelatedRouteScreen from './StrongRelatedRouteScreen'
import {
  buildPublicStrongEntityPath,
  buildPublicStrongPath,
  parsePublicStrongCode,
  publicStrongContext,
  type PublicStrongEntryPage,
} from './publicStrongRoutes'
import { parseStrongDetailRouteParams } from './strongDetailRoutes'

type PublicStrongRouteParams = {
  code?: string | string[]
  uniqueName?: string | string[]
  strongBibleVersionId?: string
  bibleVersion?: string
  clickedWord?: string
  bibleChapter?: string
  bibleVerse?: string
  morphologyCodes?: string
  language?: string
}

const firstString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export const PublicStrongEntryRouteScreen = ({ page }: { page: PublicStrongEntryPage }) => {
  const params = useLocalSearchParams<PublicStrongRouteParams>()
  const identity = parsePublicStrongCode(params.code)
  if (!identity) {
    return (
      <ResourceUnavailableView
        title="Entrée Strong introuvable"
        failure={{ cause: 'not-found', recoveries: [] }}
      />
    )
  }

  const rawCode = firstString(params.code)
  const canonicalPath = buildPublicStrongPath(identity.code, page)
  if (rawCode !== identity.code.toLocaleLowerCase()) {
    const { code: _code, ...contextParams } = params
    return <Redirect href={{ pathname: canonicalPath, params: contextParams } as Href} />
  }

  const { context: contextualParams } = parseStrongDetailRouteParams(params)
  const context = { ...contextualParams, ...publicStrongContext(identity) }
  if (page === 'dictionary') {
    return <StrongDictionaryRouteScreen context={context} isFormSheet={IS_FORM_SHEET} />
  }
  if (page === 'related') {
    return <StrongRelatedRouteScreen context={context} isFormSheet={IS_FORM_SHEET} />
  }
  if (page === 'concordance') {
    return <StrongConcordanceRouteScreen context={context} isFormSheet={IS_FORM_SHEET} />
  }
  return <StrongMainScreen key={identity.code} context={context} isFormSheet={IS_FORM_SHEET} />
}

export const PublicStrongEntityRouteScreen = () => {
  const params = useLocalSearchParams<PublicStrongRouteParams>()
  const uniqueName = firstString(params.uniqueName)?.trim()
  if (!uniqueName) {
    return (
      <ResourceUnavailableView
        title="Entité biblique introuvable"
        failure={{ cause: 'not-found', recoveries: [] }}
      />
    )
  }
  const canonicalPath = buildPublicStrongEntityPath(uniqueName)
  if (firstString(params.uniqueName) !== uniqueName) {
    const { uniqueName: _uniqueName, ...contextParams } = params
    return <Redirect href={{ pathname: canonicalPath, params: contextParams } as Href} />
  }

  const { context } = parseStrongDetailRouteParams(params)
  return (
    <StrongEntityRouteScreen
      key={uniqueName}
      context={context}
      entityKey={uniqueName}
      isFormSheet={IS_FORM_SHEET}
    />
  )
}
