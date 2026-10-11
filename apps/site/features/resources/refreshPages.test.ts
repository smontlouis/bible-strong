import { describe, expect, it } from 'vitest'
import { readArguments } from '../../scripts/refresh-pages.mjs'

describe('Command that asks the site to render pages again', () => {
  it('asks for every page, or for the pages under some folders', () => {
    expect(readArguments(['--everything'])).toMatchObject({ everything: true, paths: [] })
    expect(readArguments(['/bible/lsg', '/strong'])).toMatchObject({
      everything: false,
      paths: ['/bible/lsg', '/strong'],
      site: 'https://bible-strong.app',
    })
  })

  it('asks another site when told to', () => {
    expect(readArguments(['--site', 'https://next.example', '--everything'])).toMatchObject({
      site: 'https://next.example',
    })
  })

  it.each([
    [[]],
    [['--everything', '/bible']],
    [['bible']],
    [['/bible/lsg/gen/1']],
    [['--purge']],
    [['--site']],
  ])('refuses %j', argv => {
    expect(readArguments(argv)).toBeUndefined()
  })
})
