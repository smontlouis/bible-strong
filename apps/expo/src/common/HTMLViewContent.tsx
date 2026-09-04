import React from 'react'
import WebView from 'react-native-webview'
import useHTMLView, { type HTMLViewLinkPayload } from '~helpers/useHTMLView'

type Props = {
  html: string
  onLinkClicked: (payload: HTMLViewLinkPayload) => void
}

const HTMLViewContent = ({ html, onLinkClicked }: Props) => {
  const { webviewProps } = useHTMLView({ onLinkClicked, autoHeight: true })

  return <WebView {...webviewProps(html)} />
}

export default HTMLViewContent
