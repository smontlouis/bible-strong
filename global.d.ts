// global.d.ts
declare module 'trunc-html' {
  const truncHTML: (x: string, limit: number) => { html: string; text: string }
  export default truncHTML
}

declare module '~assets/bible_versions/bible-vod.json' {
  const VOD: { [x: string]: string }
  export default VOD
}

declare module 'react-native-progress/Circle' {
  import { Component } from 'react'
  import { ViewStyle } from 'react-native'

  interface ProgressCircleProps {
    size?: number
    progress?: number
    borderWidth?: number
    thickness?: number
    color?: string
    unfilledColor?: string
    fill?: string
    children?: React.ReactNode
    style?: ViewStyle
  }

  export default class ProgressCircle extends Component<ProgressCircleProps> {}
}
