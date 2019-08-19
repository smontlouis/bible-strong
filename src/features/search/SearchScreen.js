import React from 'react'
import debounce from 'debounce'
import { ProgressBar } from 'react-native-paper'
import * as FileSystem from 'expo-file-system'
import { Asset } from 'expo-asset'

import Container from '~common/ui/Container'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import SearchHeader from './SearchHeader'
import SearchResults from './SearchResults'
import theme from '~themes/default'
import loadIndexCache from './loadIndex'

const IDX_LIGHT_FILE_SIZE = 16795170

export default class SearchScreen extends React.Component {
  state = {
    idxProgress: undefined,
    isLoading: true,
    value: '',
    results: []
  }

  componentDidMount() {
    this.loadIndex()
  }

  loadIndex = async () => {
    const idxPath = `${FileSystem.documentDirectory}idx-light.json`
    let idxFile = await FileSystem.getInfoAsync(idxPath)

    // if (__DEV__) {
    //   if (idxFile.exists) {
    //     FileSystem.deleteAsync(idxFile.uri)
    //     idxFile = await FileSystem.getInfoAsync(idxPath)
    //   }
    // }

    if (!idxFile.exists) {
      const idxUri = Asset.fromModule(require('~assets/lunr/idx-light.txt')).uri

      console.log(`Downloading ${idxUri} to ${idxPath}`)
      await FileSystem.createDownloadResumable(
        idxUri,
        idxPath,
        null,
        this.calculateProgress
      ).downloadAsync()

      console.log('Download finished')
      idxFile = await FileSystem.getInfoAsync(idxPath)
    }

    this.idx = await loadIndexCache(idxFile)
    this.setState({ isLoading: false })
  }

  calculateProgress = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    const idxProgress = Math.floor((totalBytesWritten / IDX_LIGHT_FILE_SIZE) * 100) / 100
    this.setState({ idxProgress })
  }

  onChangeText = value => {
    if (this.idx) {
      if (value !== '') {
        const results = this.idx.search(value)
        this.setState({ results, value })
      } else {
        this.setState({ results: [], value })
      }
    }
  }

  render() {
    const { isLoading, results, value, idxProgress } = this.state
    const isProgressing = typeof idxProgress !== 'undefined'

    if (isLoading && isProgressing) {
      return (
        <Loading message={"Téléchargement de l'index..."}>
          <ProgressBar progress={idxProgress} color={theme.colors.tertiary} />
        </Loading>
      )
    }

    return (
      <Container>
        <SearchHeader
          hasBackButton
          placeholder="Recherche"
          onChangeText={debounce(this.onChangeText, 500)}
        />
        {isLoading && <Loading message={"Chargement de l'index..."} />}
        {!isLoading && !value && (
          <Empty
            source={require('~assets/images/search-loop.json')}
            message="Fais une recherche dans la Bible !"
          />
        )}
        {!isLoading && !!value && <SearchResults results={results} />}
      </Container>
    )
  }
}
