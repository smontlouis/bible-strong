import { TimelineSection, TimelineEvent } from './types'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'

// Manually unfixed : 1242 - 1244
// export const events: TimelineSection[] = require('~assets/timeline/events.txt')
const events = require('~assets/timeline/events.txt')

export const getEvents = async () => {
  const [{ localUri }] = await Asset.loadAsync(require('~assets/timeline/events.txt'))

  const json = JSON.parse(await FileSystem.readAsStringAsync(localUri as string))
  return json as TimelineSection[]
}
