import React from 'react'
import { connect } from 'react-redux'
import { StatusBar } from 'react-native'

import Container from '~common/ui/Container'
import BibleViewer from './BibleViewer'
import BibleHeader from './BibleHeader'
import BibleParamsModal from './BibleParamsModal'

import * as BibleActions from '~redux/modules/bible'
import * as UserActions from '~redux/modules/user'

class BibleScreen extends React.Component {
  state = {
    isBibleParamsOpen: false
  }

  toggleBibleParamsOpen = () => {
    this.setState(state => ({ isBibleParamsOpen: !state.isBibleParamsOpen }))
  }

  render() {
    const {
      app,
      navigation,
      isReadOnly,
      isSelectionMode,
      setSettingsAlignContent,
      setSettingsTextDisplay,
      setSettingsPress,
      setSettingsTheme,
      setSettingsNotesDisplay,
      increaseSettingsFontSizeScale,
      decreaseSettingsFontSizeScale,
      settings
    } = this.props

    const { arrayVerses } = this.props.navigation.state.params || {}

    return (
      <Container>
        <StatusBar translucent backgroundColor="white" />
        <BibleHeader
          isReadOnly={isReadOnly}
          isSelectionMode={isSelectionMode}
          book={app.book}
          chapter={app.chapter}
          verse={app.verse}
          version={app.version}
          onBibleParamsClick={this.toggleBibleParamsOpen}
        />
        <BibleViewer
          isReadOnly={isReadOnly}
          isSelectionMode={isSelectionMode}
          arrayVerses={arrayVerses}
          book={app.book}
          chapter={app.chapter}
          verse={app.verse}
          version={app.version}
          navigation={navigation}
          settings={settings}
        />
        {this.state.isBibleParamsOpen && (
          <BibleParamsModal
            onClosed={this.toggleBibleParamsOpen}
            isOpen={this.state.isBibleParamsOpen}
            setSettingsAlignContent={setSettingsAlignContent}
            setSettingsTextDisplay={setSettingsTextDisplay}
            setSettingsTheme={setSettingsTheme}
            setSettingsNotesDisplay={setSettingsNotesDisplay}
            setSettingsPress={setSettingsPress}
            increaseSettingsFontSizeScale={increaseSettingsFontSizeScale}
            decreaseSettingsFontSizeScale={decreaseSettingsFontSizeScale}
            settings={settings}
          />
        )}
      </Container>
    )
  }
}

export default connect(
  ({ bible, user }, ownProps) => {
    const { params } = ownProps.navigation.state
    return {
      isReadOnly: params && params.isReadOnly,
      isSelectionMode: params && params.isSelectionMode,
      settings: user.bible.settings,
      app: {
        book: (params && params.book) || bible.selectedBook,
        chapter: (params && params.chapter) || bible.selectedChapter,
        verse: (params && params.verse) || bible.selectedVerse,
        version: (params && params.version) || bible.selectedVersion
      }
    }
  },
  { ...BibleActions, ...UserActions }
)(BibleScreen)
