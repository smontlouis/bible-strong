import { createContext } from 'react'
import { TEXT_MOTION } from './storySceneMotion'

/**
 * How long the texts of the card that arrives wait before they rise (2026-11-26): the short
 * pause when the eye stays where it is (the prayer opens, another verse), the eye's whole journey
 * when it travels to another card, so that the text comes once it has arrived. Read by
 * StoryMotion when a text appears.
 */
export const StoryArrival = createContext<number>(TEXT_MOTION.arriveDelay)
