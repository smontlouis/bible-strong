import { DurableObject } from 'cloudflare:workers'
import { CatalogueStore, type CatalogueRequest } from './catalogue-store'

export interface GameCatalogueEnv {
  GameCatalogue: DurableObjectNamespace<GameCatalogue>
}
// One coordinated content/history catalogue for this event, shared by its rooms.
// Only batch allocation reaches it; gameplay, sockets and answers stay in WorldRoom.
export const GAME_CATALOGUE_NAME = 'bible-strong-event-catalogue'
export class GameCatalogue extends DurableObject<GameCatalogueEnv> {
  private store: CatalogueStore
  constructor(ctx: DurableObjectState, env: GameCatalogueEnv) {
    super(ctx, env)
    this.store = new CatalogueStore(ctx.storage)
    ctx.blockConcurrencyWhile(async () => {
      const { catalogueRevision, identitySeed, questionSeed } =
        await import('./catalogue-seed.generated')
      this.store.seed(catalogueRevision, questionSeed, identitySeed)
    })
  }
  allocate(request: CatalogueRequest) {
    return this.store.select(request)
  }
}
