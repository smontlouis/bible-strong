import Phaser from 'phaser'
import manifest from './generated/lexicon-reader.json'
import { AnimatedReader, loadReader } from './animated-reader'
export const loadLexiconReader = (scene: Phaser.Scene) =>
  loadReader(scene, 'lexicon-reader', manifest)
export class LexiconReader extends AnimatedReader {
  constructor(scene: Phaser.Scene) {
    super(scene, 'lexicon-reader', manifest)
  }
}
