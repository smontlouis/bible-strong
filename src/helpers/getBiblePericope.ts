import { VersionCode } from 'src/state/tabs'
import { Pericope } from '~common/types'
import { loadPericope } from './loadPericope'

async function getBiblePericope(version: VersionCode): Promise<Pericope> {
  const pericope = await loadPericope(version)
  return pericope ?? {}
}

export default getBiblePericope
