import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import StylizedHTMLViewNative from '~common/StylizedHTMLViewNative'
import { useReadingTypography } from '~common/useReadingTypography'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import { useResourceAccess } from '~features/resources/resourceAccess'
import HTMLBenchmarkDOM from './HTMLBenchmarkDOM'

type Engine = 'native' | 'dom'
type Fixture = { id: string; html: string; source: string }
type Sample = {
  engine: Engine
  fixture: string
  chars: number
  readyMs: number
  maxJsGapMs: number
  scrollMaxJsGapMs: number
  timedOut: boolean
}
type Trial = { key: number; engine: Engine; fixture: Fixture; count: number }
type Controls = {
  run: (repeats?: number, onlyFixture?: string) => Promise<Sample[]>
  preview: (engine: Engine, fixtureId: string, count?: number) => void
  clear: () => void
  results: Sample[]
  fixtures: { id: string; chars: number; source: string }[]
  status: string
}
const benchGlobal = globalThis as typeof globalThis & { __htmlBenchmark?: Controls }
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function Content({
  trial,
  onReady,
  onLink,
}: {
  trial: Trial
  onReady: () => void
  onLink: (href: string) => void
}) {
  const theme = useTheme()
  const [height, setHeight] = useState(200)
  const typography = useReadingTypography()
  const nativeReady = useRef(false)
  const html = trial.fixture.html
  if (trial.engine === 'dom')
    return (
      <HTMLBenchmarkDOM
        html={html}
        typography={typography}
        colors={{
          background: theme.colors.reverse,
          text: theme.colors.default,
          link: theme.colors.primary,
          emphasis: theme.colors.quart,
        }}
        onSizeChange={async value => {
          if (Number.isFinite(value) && value > 0) setHeight(Math.ceil(value))
        }}
        onReady={async () => {
          onReady()
        }}
        onLinkClicked={async payload => {
          onLink(payload.href)
        }}
        dom={{
          useExpoDOMWebView: false,
          containerStyle: { height, flex: 0, width: '100%' },
          scrollEnabled: false,
          style: { width: '100%', backgroundColor: 'transparent' },
          contentInsetAdjustmentBehavior: 'never',
        }}
      />
    )
  return (
    <View
      style={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: 48 }}
      onLayout={event => {
        if (nativeReady.current || event.nativeEvent.layout.height <= 56) return
        nativeReady.current = true
        requestAnimationFrame(() => requestAnimationFrame(onReady))
      }}
    >
      <StylizedHTMLViewNative
        html={html}
        typography={typography}
        colors={{
          background: theme.colors.reverse,
          text: theme.colors.default,
          link: theme.colors.primary,
          emphasis: theme.colors.quart,
        }}
        onLinkClicked={payload => onLink(payload.href)}
      />
    </View>
  )
}

export default function HTMLRenderingBenchmark({ onBack }: { onBack: () => void }) {
  const resources = useResourceAccess()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [trial, setTrial] = useState<Trial | null>(null)
  const [status, setStatus] = useState('Chargement des contenus…')
  const [results, setResults] = useState<Sample[]>([])
  const [link, setLink] = useState('')
  const running = useRef(false)
  const alive = useRef(true)
  const sequence = useRef(0)
  const pending = useRef<{ key: number; resolve: () => void } | null>(null)
  const scroll = useRef<ScrollView>(null)
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      resources.dictionary.loadItem('Aaron', 'fr'),
      resources.nave.loadItem('aaron', 'fr'),
      resources.commentary.loadResourceChapter({
        resourceId: 'bible-annotee',
        language: 'fr',
        book: 40,
        chapter: 4,
      }),
    ])
      .then(([dictionary, nave, commentary]) => {
        if (cancelled) return
        if (!dictionary?.definition || !nave?.description)
          throw new Error('Contenus Aaron indisponibles')
        const doc = dictionary.definition
        const section = commentary.sections.find(
          item => item.rangeStartVerse <= 1 && item.rangeEndVerse >= 1
        )
        if (!section) throw new Error('Commentaire Matthieu 4:1 indisponible')
        // Both engines receive the exact same strings; this stress case is explicitly synthetic.
        setFixtures([
          {
            id: 'short',
            source: 'Dictionnaire Aaron — premier paragraphe',
            html:
              doc.match(/<p\b[^>]*>[\s\S]*?<\/p>/i)?.[0] ??
              '<p>Aaron, frère de Moïse. <a href="https://example.com">Lien de test</a></p>',
          },
          { id: 'dictionary', source: 'Dictionnaire Aaron — intégral', html: doc },
          { id: 'nave', source: 'Nave Aaron — intégral', html: nave.description },
          { id: 'commentary', source: 'Bible annotée — Matthieu 4:1', html: section.content },
          {
            id: 'stress',
            source: 'Synthétique : dictionnaire Aaron répété 5 fois',
            html: Array(5).fill(doc).join(''),
          },
        ])
        setStatus('Prêt')
      })
      .catch(error => {
        if (!cancelled) setStatus(String(error))
      })
    return () => {
      cancelled = true
    }
  }, [resources])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      running.current = false
      pending.current?.resolve()
      delete benchGlobal.__htmlBenchmark
    }
  }, [])

  const run = async (repeats = 5, onlyFixture?: string) => {
    if (running.current || !fixtures.length) return []
    running.current = true
    const samples: Sample[] = []
    setResults([])
    for (let round = 0; round < repeats && alive.current; round++) {
      for (const fixture of fixtures.filter(item => !onlyFixture || item.id === onlyFixture)) {
        for (const engine of (round % 2 ? ['dom', 'native'] : ['native', 'dom']) as Engine[]) {
          if (!alive.current) break
          setTrial(null)
          await pause(350)
          if (!alive.current) return samples
          const key = ++sequence.current
          setStatus(`${round + 1}/${repeats} · ${fixture.id} · ${engine}`)
          let maxGap = 0
          let previous = performance.now()
          const heartbeat = setInterval(() => {
            const now = performance.now()
            maxGap = Math.max(maxGap, now - previous)
            previous = now
          }, 16)
          let timeout: ReturnType<typeof setTimeout> | undefined
          let timedOut = false
          const ready = new Promise<void>(resolve => {
            pending.current = { key, resolve }
            timeout = setTimeout(() => {
              timedOut = true
              resolve()
            }, 20000)
          })
          const start = performance.now()
          setTrial({ key, engine, fixture, count: 1 })
          await ready
          const readyMs = performance.now() - start
          clearTimeout(timeout)
          if (!alive.current) {
            clearInterval(heartbeat)
            return samples
          }
          const maxJsGapMs = maxGap
          maxGap = 0
          previous = performance.now()
          // Identical native scroll commands; heartbeat measures JS availability, not UI FPS.
          for (const y of [300, 600, 900, 1200, 600, 0]) {
            if (!alive.current) break
            scroll.current?.scrollTo({ y, animated: true })
            await pause(180)
          }
          clearInterval(heartbeat)
          pending.current = null
          samples.push({
            engine,
            fixture: fixture.id,
            chars: fixture.html.length,
            readyMs,
            maxJsGapMs,
            scrollMaxJsGapMs: maxGap,
            timedOut,
          })
          setResults([...samples])
        }
      }
    }
    running.current = false
    setTrial(null)
    setStatus('Terminé')
    return samples
  }
  const preview = (engine: Engine, fixtureId: string, count = 1) => {
    if (running.current) return
    const fixture = fixtures.find(item => item.id === fixtureId)
    if (fixture) {
      setTrial({ key: ++sequence.current, engine, fixture, count: Math.max(1, Math.min(5, count)) })
      setStatus(`${engine} · ${fixtureId} · ${count} vue(s)`)
    }
  }
  useEffect(() => {
    benchGlobal.__htmlBenchmark = {
      run,
      preview,
      clear: () => setTrial(null),
      results,
      fixtures: fixtures.map(({ id, html, source }) => ({ id, chars: html.length, source })),
      status,
    }
  })
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.reverse }}>
      <View style={{ padding: 12, gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text>← Playground</Text>
        </Pressable>
        <Text style={{ fontWeight: 'bold' }}>HTML : Native / Expo DOM</Text>
        <Text>
          {Platform.OS} · {__DEV__ ? 'Développement — pas Release' : 'Release'} · {status}
        </Text>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <Pressable
            accessibilityRole="button"
            disabled={!fixtures.length || running.current}
            onPress={() => {
              void run()
            }}
          >
            <Text>Lancer 5 passages</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => preview('native', 'dictionary')}>
            <Text>Voir natif</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => preview('dom', 'dictionary')}>
            <Text>Voir DOM</Text>
          </Pressable>
        </View>
        <Text>
          {results.length} mesures ·{' '}
          {link ? `Lien reçu : ${link}` : 'Les liens de test restent dans le playground.'}
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ width: '100%', maxWidth: 600, alignSelf: 'center' }}
      >
        {!trial && results.length > 0 && (
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontWeight: 'bold' }}>Médianes après le premier passage</Text>
            <Text>
              Temps de préparation et plus longue pause JS. Ce ne sont pas des mesures de FPS.
            </Text>
            {fixtures.map(fixture => (
              <View key={fixture.id} style={{ gap: 4 }}>
                <Text style={{ fontWeight: 'bold' }}>
                  {fixture.source} ({fixture.html.length} caractères)
                </Text>
                {(['native', 'dom'] as Engine[]).map(engine => {
                  const samples = results
                    .filter(sample => sample.fixture === fixture.id && sample.engine === engine)
                    .slice(1)
                  const median = (field: 'readyMs' | 'maxJsGapMs') => {
                    const values = samples.map(sample => sample[field]).sort((a, b) => a - b)
                    const mid = Math.floor(values.length / 2)
                    return values.length
                      ? Math.round(
                          values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2
                        )
                      : '—'
                  }
                  return (
                    <Text key={engine}>
                      {engine} : prêt {median('readyMs')} ms · pause JS {median('maxJsGapMs')} ms ·
                      n={samples.length}
                    </Text>
                  )
                })}
              </View>
            ))}
          </View>
        )}
        {trial &&
          Array.from({ length: trial.count }, (_, index) => (
            <View
              key={`${trial.key}:${index}`}
              style={
                index
                  ? { position: 'absolute', width: '100%', opacity: 0, pointerEvents: 'none' }
                  : undefined
              }
            >
              <Content
                trial={trial}
                onLink={setLink}
                onReady={() => {
                  if (index === 0 && pending.current?.key === trial.key) pending.current.resolve()
                }}
              />
            </View>
          ))}
      </ScrollView>
    </View>
  )
}
