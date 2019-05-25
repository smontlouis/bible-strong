import React from 'react'
import { FileSystem, Asset } from 'expo'
import { TouchableOpacity } from 'react-native'
import { ProgressBar } from 'react-native-paper'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'

const BIBLE_FILESIZE = 5000000

const Container = styled.View({
  padding: 15,
  paddingTop: 10,
  paddingBottom: 10
})

const TouchableContainer = Container.withComponent(TouchableOpacity)

const TextVersion = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 12
}))

const TextName = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  backgroundColor: 'transparent'
}))

class VersionSelectorItem extends React.Component {
  state = {
    versionNeedsDownload: undefined,
    fileProgress: 0,
    isLoading: false
  }

  async componentDidMount () {
    const { version } = this.props
    const versionNeedsDownload = await getIfVersionNeedsDownload(version.id)
    this.setState({ versionNeedsDownload })
  }

  requireBibleFileUri = (id) => {
    switch (id) {
      case 'DBY': {
        return Asset.fromModule(require('~assets/bible_versions/bible-dby.txt')).uri
      }
      case 'OST': {
        return Asset.fromModule(require('~assets/bible_versions/bible-ost.txt')).uri
      }
    }
  }

  calculateProgress = ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    const fileProgress = Math.floor(totalBytesWritten / BIBLE_FILESIZE * 100) / 100
    this.setState({ fileProgress })
  }

  startDownload = async () => {
    const { version } = this.props

    this.setState({ isLoading: true })

    const path = `${FileSystem.documentDirectory}bible-${version.id}.json`
    const uri = this.requireBibleFileUri(version.id)

    console.log(`Downloading ${uri} to ${path}`)
    await FileSystem.createDownloadResumable(uri, path, null, this.calculateProgress).downloadAsync()

    console.log('Download finished')

    this.setState({ versionNeedsDownload: false })
  }

  render () {
    const { version, isSelected, onChange, theme } = this.props
    const { versionNeedsDownload, isLoading, fileProgress } = this.state

    if (typeof versionNeedsDownload === 'undefined') {
      return null
    }

    if (versionNeedsDownload) {
      return (
        <Container>
          <Box flex row>
            <Box disabled flex>
              <TextVersion >{version.id}</TextVersion>
              <TextName >{version.name}</TextName>
            </Box>
            { !isLoading &&
            <Button
              reverse
              small
              title='Télécharger'
              onPress={this.startDownload}
            />
            }
            {
              isLoading &&
              <Box width={100} justifyContent='center'>
                <ProgressBar progress={fileProgress} color={theme.colors.default} />
              </Box>
            }
          </Box>
        </Container>
      )
    }

    return (
      <TouchableContainer onPress={() => onChange(version.id)}>
        <TextVersion isSelected={isSelected}>{version.id}</TextVersion>
        <TextName isSelected={isSelected}>{version.name}</TextName>
      </TouchableContainer>
    )
  }
}

export default withTheme(VersionSelectorItem)
