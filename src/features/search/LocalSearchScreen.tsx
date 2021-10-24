import * as Sentry from '@sentry/react-native'
import * as FileSystem from 'expo-file-system'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import booksDesc from '~assets/bible_versions/books-desc'
import DropdownMenu from '~common/DropdownMenu'
import Empty from '~common/Empty'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import SnackBar from '~common/SnackBar'
import Container from '~common/ui/Container'
import loadBible from '~helpers/loadBible'
import useDebounce from '~helpers/useDebounce'
import i18n from '~i18n'
import loadIndexCache from './loadIndexCache'
import LocalSearchResults from './LocalSearchResults'
import waitForIndex from './waitForIndex'

// Lazynesss
const books = [
  {
    Numero: 0,
    Nom: 'Tout',
    Chapitres: 0,
  },
  ...booksDesc,
].map(book => ({
  value: book.Numero,
  label: book.Nom,
}))
// End lazyness

const sectionValues = [
  { value: '', label: 'Tout' },
  { value: 'at', label: 'Ancien Testament' },
  { value: 'nt', label: 'Nouveau Testament' },
]

const orderValues = [
  { value: '', label: 'Par pertinence' },
  { value: 'a', label: 'Par ordre alphabétique' },
]

const timeout = ms => new Promise(r => setTimeout(r, ms))

export let bibleLSG

const LocalSearchScreen = ({ idxFile }: { idxFile: FileSystem.FileInfo }) => {
  const { t } = useTranslation()
  const index = useRef<FileSystem.FileInfo>()
  const [isLoading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearchValue = useDebounce(searchValue, 300)
  const [results, setResults] = useState(null)

  const [section, setSection] = useState('')
  const [order, setOrder] = useState('')
  const [book, setBook] = useState(0)

  useEffect(() => {
    const setIndexCache = async () => {
      await timeout(500)
      index.current = await loadIndexCache(idxFile)
      bibleLSG = await loadBible('LSG')
      setLoading(false)
    }
    setIndexCache()
  }, [idxFile])

  useEffect(() => {
    const filterResults = results => {
      if (!section && !book && !order) {
        return results
      }

      if (order === 'a') {
        // HEAVY
        if (results) {
          results.sort(({ ref: a }, { ref: b }) => {
            function chunkify(t) {
              const tz = []
              let x = 0
              let y = -1
              let n = 0
              let i
              let j

              while ((i = (j = t.charAt(x++)).charCodeAt(0))) {
                const m = i == 46 || (i >= 48 && i <= 57)
                if (m !== n) {
                  tz[++y] = ''
                  n = m
                }
                tz[y] += j
              }
              return tz
            }

            const aa = chunkify(a)
            const bb = chunkify(b)

            for (x = 0; aa[x] && bb[x]; x++) {
              if (aa[x] !== bb[x]) {
                const c = Number(aa[x])
                const d = Number(bb[x])
                if (c == aa[x] && d == bb[x]) {
                  return c - d
                }
                return aa[x] > bb[x] ? 1 : -1
              }
            }
            return aa.length - bb.length
          })
        }
      }

      return results.filter(r => {
        let isPristine = true
        const [bookRef, chapterRef, verseRef] = r.ref.split('-')

        // by Section
        if (section) {
          switch (section) {
            case 'nt': {
              if (bookRef <= 39) isPristine = false
              break
            }
            case 'at': {
              if (bookRef > 39) isPristine = false
              break
            }
            default:
              break
          }
        }

        // by Book
        if (book) {
          if (book != bookRef) isPristine = false
        }

        return isPristine
      })
    }

    if (index.current) {
      if (debouncedSearchValue) {
        try {
          const val = debouncedSearchValue.toLowerCase()

          const results = index.current.query(q => {
            // look for an exact match and apply a large positive boost
            q.term(val, {
              usePipeline: true,
              boost: 100,
            })

            // look for terms that match the beginning of this queryTerm and apply a medium boost
            q.term(val + '*', {
              usePipeline: true,
              boost: 10,
            })

            // look for terms that match with an edit distance of 2 and apply a small boost
            q.term(val, {
              usePipeline: true,
              editDistance: 2,
              boost: 1,
            })
          })
          console.log(debouncedSearchValue.toLowerCase(), results)
          setResults(filterResults(results))
        } catch (e) {
          Sentry.captureException(e)
          console.log(e)
          SnackBar.show(t('Une erreur est survenue.'), 'danger')
        }
      } else {
        setResults(null)
      }
    }
  }, [book, debouncedSearchValue, index, order, section, setResults])

  if (isLoading) {
    return <Loading message={t("Chargement de l'index...")} />
  }

  return (
    <Container>
      <SearchInput
        placeholder={t('Recherche par mot ou phrase')}
        onChangeText={setSearchValue}
        value={searchValue}
        onDelete={() => setSearchValue('')}
      />
      <ScrollView
        horizontal
        style={{ maxHeight: 55, paddingHorizontal: 10 }}
        contentContainerStyle={{
          flexDirection: 'row',
        }}
      >
        <DropdownMenu
          title={t('Ordre')}
          currentValue={order}
          setValue={setOrder}
          choices={orderValues}
        />
        <DropdownMenu
          title={t('Section')}
          currentValue={section}
          setValue={setSection}
          choices={sectionValues}
        />
        <DropdownMenu
          title={t('Livre')}
          currentValue={book}
          setValue={setBook}
          choices={books}
        />
      </ScrollView>
      {debouncedSearchValue && Array.isArray(results) ? (
        <LocalSearchResults results={results} />
      ) : (
        <Empty
          source={require('~assets/images/search-loop.json')}
          message={t('Fais une recherche dans la Bible !')}
        />
      )}
    </Container>
  )
}

const LocalSearchScreenWrapper = waitForIndex(LocalSearchScreen)

LocalSearchScreenWrapper.navigationOptions = () => ({
  tabBarLabel: i18n.t('Hors-ligne'),
})

export default LocalSearchScreenWrapper
