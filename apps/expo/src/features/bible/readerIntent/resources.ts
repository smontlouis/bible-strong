import { appLogger } from '~helpers/agentObservability'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { setSettingsContextualInformationDisplay } from '~redux/modules/user/settings'
import { isRepairingBibleDatabaseAtom } from '~state/bibleDatabaseRepair'
import type { ReaderRule, ResourceIntent } from './types'
import type { ReaderSnapshot, ReaderWorld } from './world'

type ResourceContext = { snapshot: ReaderSnapshot; world: ReaderWorld }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

export const decodeResourceIntent = (value: unknown): ResourceIntent | undefined => {
  if (!isRecord(value)) return undefined
  switch (value.kind) {
    case 'install-bible-version':
      return isText(value.version) ? { kind: value.kind, version: value.version } : undefined
    case 'open-downloads':
    case 'repair-bible-database':
    case 'retry-bible-resource':
    case 'install-biblical-entities':
    case 'hide-contextual-information':
      return { kind: value.kind }
    default:
      return undefined
  }
}

/** The web reads its Bible text from the network: what the device would install, it reads again. */
const isWeb = (world: ReaderWorld) => world.platform === 'web'

/** The web keeps no Offline copy: no downloads to open, no biblical entities to install. */
export const getResourceRefusal = (
  intent: ResourceIntent,
  { world }: Pick<ResourceContext, 'world'>
): ReaderRule | undefined => {
  if (
    isWeb(world) &&
    (intent.kind === 'open-downloads' || intent.kind === 'install-biblical-entities')
  ) {
    return 'no-offline-copies'
  }
  return undefined
}

const readBibleTextAgain = (world: ReaderWorld) => world.refetch(resourceQueryKeys.bibleContent())

const repairBibleDatabase = async (world: ReaderWorld) => {
  world.store.set(isRepairingBibleDatabaseAtom, true)
  try {
    await world.repairBibleDatabase()
    world.notify({ type: 'success', message: world.t('bible.error.databaseRecovered') })
  } catch {
    world.notify({ type: 'error', message: world.t('bible.error.databaseOpenFailed') })
  } finally {
    world.store.set(isRepairingBibleDatabaseAtom, false)
  }
}

export const applyResourceIntent = async (
  intent: ResourceIntent,
  { snapshot, world }: ResourceContext
) => {
  switch (intent.kind) {
    case 'install-bible-version':
      if (isWeb(world)) {
        await readBibleTextAgain(world)
        return
      }
      try {
        world.queueOfflineCopy({ kind: 'bible', version: intent.version })
      } catch (error) {
        appLogger.warn('webview', 'reader_intent.offline_copy_unavailable', {
          version: intent.version,
          message: error instanceof Error ? error.message : String(error),
        })
        world.notify({ type: 'error', message: world.t('bible.error.unknown') })
      }
      return
    case 'open-downloads':
      world.navigate({ pathname: '/downloads' })
      return
    case 'repair-bible-database':
      if (isWeb(world)) {
        await readBibleTextAgain(world)
        return
      }
      await repairBibleDatabase(world)
      return
    case 'retry-bible-resource':
      await readBibleTextAgain(world)
      return
    case 'install-biblical-entities':
      // Offered only while the entities are not installed. Their status says nothing of the
      // core until they are: the queue brings the core when it is not at the catalog revision.
      if (!snapshot.biblicalEntitiesStatus || snapshot.biblicalEntitiesStatus === 'available') {
        return
      }
      world.queueOfflineCopy({ kind: 'biblical-entities' })
      return
    case 'hide-contextual-information': {
      const confirmed = await world.confirm({
        title: world.t('bible.chapterEntities.dismissTitle'),
        message: world.t('bible.chapterEntities.dismissMessage'),
        cancelLabel: world.t('Annuler'),
        confirmLabel: world.t('bible.chapterEntities.dismissConfirm'),
      })
      if (confirmed) world.dispatch(setSettingsContextualInformationDisplay(false))
      return
    }
  }
}
