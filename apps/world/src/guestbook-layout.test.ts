import { describe, expect, it } from 'vitest'
import {
  constrainCamera,
  minimumZoom,
  noteBounds,
  noteLines,
  overlaps,
  placeNote,
  wallBounds,
  type NotePlacement,
} from './guestbook-layout'

describe('guestbook wall', () => {
  it('starts at the centre and grows without moving or overlapping rotated notes', () => {
    const notes: NotePlacement[] = []
    for (let index = 0; index < 80; index++) {
      const next = placeNote(
        String(index),
        index % 3 ? 'Merci pour cette belle découverte !' : 'Long message. '.repeat(30),
        notes
      )
      expect(notes.some(note => overlaps(noteBounds(note, 8), noteBounds(next)))).toBe(false)
      notes.push(next)
    }
    expect(notes[0]).toMatchObject({ x: 0, y: 0 })
    expect(placeNote('0', 'Long message. '.repeat(30), [])).toEqual(notes[0])
    const bounds = wallBounds(notes)
    for (const note of notes) {
      const box = noteBounds(note)
      expect(box.left).toBeGreaterThan(bounds.left)
      expect(box.right).toBeLessThan(bounds.right)
      expect(box.top).toBeGreaterThan(bounds.top)
      expect(box.bottom).toBeLessThan(bounds.bottom)
    }
    expect(minimumZoom(bounds, 390, 700)).toBeLessThan(
      minimumZoom(wallBounds(notes.slice(0, 1)), 390, 700)
    )
  })
  it('fits the occupied area and prevents panning away into empty space', () => {
    const bounds = { left: -500, right: 500, top: -400, bottom: 400 }
    expect(constrainCamera({ x: 100000, y: -100000, zoom: 0.01 }, bounds, 400, 800)).toEqual({
      x: 0,
      y: 0,
      zoom: 0.4,
    })
    expect(constrainCamera({ x: 100000, y: -100000, zoom: 1 }, bounds, 400, 600)).toEqual({
      x: 300,
      y: -100,
      zoom: 1,
    })
  })
  it('keeps the current reading view when the wall expands', () => {
    const camera = { x: 0, y: 0, zoom: 1 }
    expect(
      constrainCamera(camera, { left: -1000, right: 1500, top: -1000, bottom: 1500 }, 400, 600)
    ).toEqual(camera)
  })
  it('sizes multiline and wide-Unicode messages without truncating text', () => {
    const text = 'Merci 🌍 '.repeat(40) + '\n\nÀ bientôt !'
    expect(noteLines(text).join('').replaceAll('\n', '')).toBe(text.replaceAll('\n', ''))
    expect(placeNote('a', text, []).height).toBeGreaterThan(placeNote('a', 'Merci', []).height)
    expect(noteLines('a\n\nb')).toEqual(['a', '', 'b'])
  })
})
