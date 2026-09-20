import Phaser from 'phaser'
import manifest from './generated/dictionary-reader.json'
import { AnimatedReader, loadReader } from './animated-reader'
export const loadDictionaryReader = (scene: Phaser.Scene) =>
  loadReader(scene, 'dictionary-reader', manifest)
export class DictionaryReader extends AnimatedReader {
  constructor(scene: Phaser.Scene) {
    super(scene, 'dictionary-reader', manifest)
  }
}
