import React from 'react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import WebViewQuillEditor from '~features/studies/react-native-webview-quilljs/WebViewQuillEditor'

export default class App extends React.Component {
  state = {
    editorMessageDelta: [
      { insert: 'Hello World' },
      { insert: '!', attributes: { bold: true } }
    ]
  }

  getEditorDelta = () => {
    this.webViewQuillEditor.getDelta()
  };

  getDeltaCallback = response => {
    console.log('get delta')
  };

  onDeltaChangeCallback = (delta, deltaChange, deltaOld, changeSource) => {
    console.log('text changed')
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
          />
        </Box>
      </Container>
    )
  }
}
