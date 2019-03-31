import React from 'react'
import debounce from 'debounce'

import Container from '~common/ui/Container'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import SearchHeader from './SearchHeader'
import SearchResults from './SearchResults'

const loadIndex = new Promise((resolve, reject) => {
  try {
    const lunr = require('lunr')
    require('lunr-languages/lunr.stemmer.support')(lunr)
    require('lunr-languages/lunr.fr')(lunr)
    require('~helpers/lunr.unicodeNormalizer')(lunr)

    const data = require('~assets/bible_versions/idx-light.json')
    const idx = lunr.Index.load(data)
    resolve(idx)
  } catch (e) {
    reject(e)
  }
})

export default class SearchScreen extends React.Component {
  state = {
    isLoading: true,
    value: '',
    results: []
  }
  componentDidMount () {
    this.loadIndex()
  }
  loadIndex = async () => {
    this.idx = await loadIndex
    this.setState({ isLoading: false })
  }
  onChangeText = value => {
    if (value !== '') {
      const results = this.idx.search(value)
      this.setState({ results, value })
    } else {
      this.setState({ results: [], value })
    }
  }
  render () {
    const { isLoading, results, value } = this.state

    if (isLoading) {
      return <Loading message="Chargement de l'index..." />
    }

    return (
      <Container>
        <SearchHeader
          placeholder='Recherche'
          onChangeText={debounce(this.onChangeText, 500)}
        />
        {!value && (
          <Empty
            source={require('~assets/images/search-loop.json')}
            message='Fais une recherche dans la Bible !'
          />
        )}
        {!!value && <SearchResults results={results} />}
      </Container>
    )
  }
}
