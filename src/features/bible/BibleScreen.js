import React from 'react'
import { connect } from 'react-redux'
import { StatusBar } from 'react-native'
import produce from 'immer'
import compose from 'recompose/compose'
import { withTheme } from 'emotion-theming'

import books from '~assets/bible_versions/books-desc'
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
      setSettingsCommentaires,
      increaseSettingsFontSizeScale,
      decreaseSettingsFontSizeScale,
      settings
    } = this.props

    const { focusVerses } = this.props.navigation.state.params || {}

    if (Number.isInteger(app.book)) {
      app.book = books[app.book - 1]
    }

    return (
      <Container>
        <StatusBar translucent backgroundColor="white" />
        <BibleHeader
          isReadOnly={isReadOnly}
          isSelectionMode={isSelectionMode}
          book={app.book}
          chapter={app.chapter}
          verse={app.verse}
          focusVerses={focusVerses}
          version={app.version}
          onBibleParamsClick={this.toggleBibleParamsOpen}
        />
        <BibleViewer
          isReadOnly={isReadOnly}
          isSelectionMode={isSelectionMode}
          focusVerses={focusVerses}
          book={app.book}
          chapter={app.chapter}
          verse={app.verse}
          version={app.version}
          navigation={navigation}
          settings={settings}
          setSettingsCommentaires={setSettingsCommentaires}
        />
        {this.state.isBibleParamsOpen && (
          <BibleParamsModal
            navigation={navigation}
            onClosed={this.toggleBibleParamsOpen}
            isOpen={this.state.isBibleParamsOpen}
            setSettingsAlignContent={setSettingsAlignContent}
            setSettingsTextDisplay={setSettingsTextDisplay}
            setSettingsTheme={setSettingsTheme}
            setSettingsNotesDisplay={setSettingsNotesDisplay}
            setSettingsPress={setSettingsPress}
            setSettingsCommentaires={setSettingsCommentaires}
            increaseSettingsFontSizeScale={increaseSettingsFontSizeScale}
            decreaseSettingsFontSizeScale={decreaseSettingsFontSizeScale}
            settings={settings}
          />
        )}
      </Container>
    )
  }
}

export default compose(
  withTheme,
  connect(
    ({ bible, user }, ownProps) => {
      const { params } = ownProps.navigation.state
      return {
        isReadOnly: params && params.isReadOnly,
        isSelectionMode: params && params.isSelectionMode,
        settings: produce(user.bible.settings, draftState => {
          draftState.colors.default = {
            ...ownProps.theme.colors,
            ...draftState.colors.default
          }
          draftState.colors.dark = {
            ...ownProps.theme.colors,
            ...draftState.colors.dark
          }
        }),
        app: {
          book: (params && params.book) || bible.selectedBook,
          chapter: (params && params.chapter) || bible.selectedChapter,
          verse: (params && params.verse) || bible.selectedVerse,
          version: (params && params.version) || bible.selectedVersion
        }
      }
    },
    { ...BibleActions, ...UserActions }
  )
)(BibleScreen)
