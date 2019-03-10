import React from 'react'
import debounce from 'debounce'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Loading from '~common/Loading'
import SearchHeader from './SearchHeader'

const loadIndex = new Promise((resolve, reject) => {
  try {
    const lunr = require('lunr')

    require('lunr-languages/lunr.stemmer.support')(lunr)
    require('lunr-languages/lunr.fr')(lunr)

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
    const results = this.idx.search(value)
    this.setState({ results })
  }
  render () {
    const { isLoading } = this.state

    if (isLoading) {
      return <Loading message="Chargement de l'index..." />
    }
    return (
      <Container>
        <SearchHeader
          placeholder='Recherche'
          onChangeText={debounce(this.onChangeText, 500)}
        />
        <Box flex />
      </Container>
    )
  }
}
