import Phaser from 'phaser'
import { AnimatedReader, loadReader, type ReaderManifest } from './animated-reader'
import reader0 from './generated/lexicon-reader.json'
import reader1 from './generated/dictionary-reader.json'
import reader2 from './generated/themes-reader.json'
import reader3 from './generated/commentaries-reader.json'
import reader4 from './generated/references-reader.json'
import reader5 from './generated/comparison-left-reader.json'
import reader6 from './generated/comparison-right-reader.json'

export const worldReaders: { id: string; manifest: ReaderManifest }[] = [
  { id: 'lexicon-reader', manifest: reader0 },
  { id: 'dictionary-reader', manifest: reader1 },
  { id: 'themes-reader', manifest: reader2 },
  { id: 'commentaries-reader', manifest: reader3 },
  { id: 'references-reader', manifest: reader4 },
  { id: 'comparison-left-reader', manifest: reader5 },
  { id: 'comparison-right-reader', manifest: reader6 },
]

export function loadWorldReaders(scene: Phaser.Scene) {
  for (const { id, manifest } of worldReaders) loadReader(scene, id, manifest)
}
export function createWorldReaders(scene: Phaser.Scene) {
  return worldReaders.map(({ id, manifest }) => new AnimatedReader(scene, id, manifest))
}
