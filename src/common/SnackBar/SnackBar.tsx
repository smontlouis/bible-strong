import React, { Component } from 'react'

import {
  Animated,
  Easing,
  InteractionManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { withSafeAreaInsets } from 'react-native-safe-area-context'

const DEFAULT_DURATION: number = 5000
const DEFAULT_FADEOUT_DURATION: number = 250
const INITIAL_POSITION_BOTTOM: number = -180
const INITIAL_POSITION_TOP: number = 0
const TO_POSITION_BOTTOM: number = 180
const TO_POSITION_TOP: number = -360

const STYLE_BANNER_COLOR: string = '#000000'
const TEXT_COLOR_ACCENT: string = '#fff'

const styles = StyleSheet.create({
  containerBottom: {
    flex: 1,
    position: 'absolute',
    bottom: INITIAL_POSITION_BOTTOM,
  },

  containerTop: {
    flex: 1,
    position: 'absolute',
    top: INITIAL_POSITION_TOP,
  },

  text: {
    padding: 15,
    fontSize: 16,
  },

  inlineText: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },

  buttonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  button: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },

  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },

  flat: {
    fontSize: 14,
  },
})

interface Props {
  // Behaviour
  fadeOutDuration?: number
  duration?: number
  isStatic?: boolean
  tapToClose?: boolean

  // Functions
  onConfirm: () => void
  onCancel: () => void
  onAutoDismiss: () => void

  title: string
  textStyle: object
  confirmText: string
  cancelText: string

  // Styles
  style: object
  renderContent: any
  backgroundColor: string
  buttonColor: string
  textColor: string
  position: string
  insets?: any
}

interface State {
  transformOffsetYTop: any
  transformOffsetYBottom: any
  transformOpacity: any
}

class SnackBar extends Component<Props, State> {
  static defaultProps = {
    // Behaviour
    fadeOutDuration: DEFAULT_FADEOUT_DURATION,
    duration: DEFAULT_DURATION,
    isStatic: false,

    // Functions
    onConfirm: Function,
    onCancel: Function,
    onAutoDismiss: Function,

    // Styles
    style: {},
    renderContent: null,
    backgroundColor: STYLE_BANNER_COLOR,
    buttonColor: TEXT_COLOR_ACCENT,
    textColor: 'white',
    position: 'bottom',
  }

  constructor(props: Props) {
    super(props)

    this.state = {
      transformOffsetYTop: new Animated.Value(-180),
      transformOffsetYBottom: new Animated.Value(0),
      transformOpacity: new Animated.Value(0),
    }
  }

  componentDidMount() {
    this.show()
  }

  componentWillUnmount() {
    if (this.props.isStatic) {
      this.hide()
    }
  }

  show = () => {
    const { transformOpacity, transformOffsetYTop, transformOffsetYBottom } = this.state

    const { fadeOutDuration, isStatic, duration, position } = this.props

    const initialPosition = position === 'top' ? INITIAL_POSITION_TOP : INITIAL_POSITION_BOTTOM
    const transformOffsetY = position === 'top' ? transformOffsetYTop : transformOffsetYBottom

    Animated.parallel([
      Animated.timing(transformOpacity, {
        toValue: 1,
        duration: fadeOutDuration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(transformOffsetY, {
        toValue: initialPosition,
        duration: fadeOutDuration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (isStatic) {
        return
      }

      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          this.hide()
        }, duration)
      })
    })
  }

  hide = () => {
    const { transformOpacity, transformOffsetYTop, transformOffsetYBottom } = this.state

    const { fadeOutDuration, onAutoDismiss, position } = this.props

    const transformOffsetY = position === 'top' ? transformOffsetYTop : transformOffsetYBottom
    const toPosition = position === 'top' ? TO_POSITION_TOP : TO_POSITION_BOTTOM

    Animated.parallel([
      Animated.timing(transformOpacity, {
        toValue: 0,
        duration: fadeOutDuration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(transformOffsetY, {
        toValue: toPosition,
        easing: Easing.inOut(Easing.quad),
        duration: fadeOutDuration,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAutoDismiss && onAutoDismiss()
    })
  }

  // @ts-ignore
  renderButton = (text: string, onPress: () => void, style?: object) => {
    const { buttonColor } = this.props

    return (
      <TouchableOpacity
        style={styles.buttonContainer}
        onPress={() => {
          onPress()
          this.hide()
        }}
      >
        <Text style={[styles.button, style, { color: buttonColor }]}>{text}</Text>
      </TouchableOpacity>
    )
  }

  renderContent = () => {
    const { confirmText, onConfirm, cancelText, onCancel, title, textColor, textStyle } = this.props

    const titleElement = <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>

    if (confirmText && cancelText) {
      return (
        <View>
          {titleElement}
          <View style={styles.actionRow}>
            {this.renderButton(cancelText, onCancel, styles.flat)}
            {this.renderButton(confirmText, onConfirm, styles.flat)}
          </View>
        </View>
      )
    }

    if (confirmText) {
      return (
        <View style={styles.inlineRow}>
          <Text style={[styles.inlineText, { color: textColor }]}>{title}</Text>
          {this.renderButton(confirmText, onConfirm)}
        </View>
      )
    }

    return titleElement
  }

  render() {
    const { style, renderContent, backgroundColor, position, tapToClose } = this.props

    const isTop = position === 'top'
    const transformOffsetY = isTop
      ? this.state.transformOffsetYTop
      : this.state.transformOffsetYBottom
    return (
      <TouchableWithoutFeedback onPress={() => tapToClose && this.hide()}>
        <Animated.View
          style={[
            (isTop && styles.containerTop) || (!isTop && styles.containerBottom),
            {
              opacity: this.state.transformOpacity,
              transform: [{ translateY: transformOffsetY }],
              backgroundColor,
              // @ts-ignore
              marginBottom: this.props.insets?.bottom,
              left: 10,
              right: 10,
              borderRadius: 10,
            },
            style,
          ]}
        >
          {renderContent ? renderContent() : this.renderContent()}
        </Animated.View>
      </TouchableWithoutFeedback>
    )
  }
}

// @ts-ignore
export default withSafeAreaInsets(SnackBar)
