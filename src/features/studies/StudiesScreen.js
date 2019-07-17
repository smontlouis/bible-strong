import React from 'react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import WebViewQuillEditor from '~features/studies/studiesWebView/WebViewQuillEditor'

export default class App extends React.Component {
  state = {
    editorMessageDelta: [
      { insert: 'Hello World\n' },
      { insert: "I'm " },
      { insert: 'bold\n\n', attributes: { bold: true, 'inline-verse': { title: 'Genèse 1:1', verses: ['1-1-1'] } } },
      { insert: 'Dude :)' },
      {
        insert: {
          'block-verse': {
            title: 'bla',
            verses: '[1-1-1]'
          }
        }
      },
      { insert: { divider: true } }
    ]
  }

  getEditorDelta = () => {
    this.webViewQuillEditor.getDelta()
  };

  getDeltaCallback = response => {
    console.log('get delta')
  };

  onDeltaChangeCallback = (delta, deltaChange, deltaOld, changeSource) => {
  };

  render () {
    return (
      <Container>
        <Header title='Études' />
        <Box flex>
          <WebViewQuillEditor
            ref={component => (this.webViewQuillEditor = component)}
            getDeltaCallback={this.getDeltaCallback}
            onDeltaChangeCallback={this.onDeltaChangeCallback}
            contentToDisplay={this.state.editorMessageDelta}
            params={this.props.navigation.state.params}
          />
        </Box>
      </Container>
    )
  }
}
