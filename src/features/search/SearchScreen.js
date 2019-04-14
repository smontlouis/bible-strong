import React from 'react'
import { FileSystem, Asset } from 'expo'
import debounce from 'debounce'

import Container from '~common/ui/Container'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import SearchHeader from './SearchHeader'
import SearchResults from './SearchResults'

const loadIndex = async () => {
  const lunr = require('lunr')
  require('lunr-languages/lunr.stemmer.support')(lunr)
  require('lunr-languages/lunr.fr')(lunr)
  require('~helpers/lunr.unicodeNormalizer')(lunr)

  const idxPath = `${FileSystem.documentDirectory}idx-light.json`
  let idxFile = await FileSystem.getInfoAsync(idxPath)

  console.log('Index exists ?', idxFile.exists)

  if (!idxFile.exists) {
    const idxUri = Asset.fromModule(require('~assets/lunr/idx-light.txt')).uri
    console.log(`Downloading ${idxUri} to ${idxPath}`)
    await FileSystem.createDownloadResumable(idxUri, idxPath, null, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      console.log(totalBytesWritten, totalBytesExpectedToWrite)
    }).downloadAsync()
    console.log('Download finished')
    idxFile = await FileSystem.getInfoAsync(idxPath)
  }

  const data = await FileSystem.readAsStringAsync(idxFile.uri)
  const idx = lunr.Index.load(JSON.parse(data))
  return idx
}

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
    this.idx = await loadIndex()
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
