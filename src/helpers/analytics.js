import { Analytics, PageHit, Event } from 'expo-analytics'

export default new Analytics('UA-109677220-3')

export const screen = page => new PageHit(page)
export const event = (category, action, label, value) => new Event(category, action, label, value)
