import React, { Component } from 'react'
import { TouchableOpacity } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { pure } from 'recompose'
import styled from '@emotion/native'

const StyledTextInput = styled.TextInput((hasNoIcon, isRounded, isLight) => ({
  fontSize: 16,
  color: 'black'
}))

const IconButton = styled.View({
  backgroundColor: 'transparent',
  position: 'absolute',
  right: 16,
  top: 13
})

const IconButtonTouch = IconButton.withComponent(TouchableOpacity)

const Container = styled.View(({ isLight }) => ({
  flex: 1,
  paddingTop: 15,
  paddingBottom: 15,
  paddingLeft: 20,
  paddingRight: 35,
  overflow: 'hidden',
  backgroundColor: 'rgba(0,0,0,0.1)',
  borderBottomWidth: 0,
  borderRadius: 40,
  ...(isLight && { backgroundColor: 'rgba(0,0,0,0.05)', color: 'black' })
}))

class SearchInput extends Component {
  static defaultProps = {
    noIcon: false,
    round: false,
    icon: {}
  }

  state = {
    hasText: false
  }

  componentDidMount () {
    this.input.focus()
  }

  onChangeText = (value: string) => {
    if (value) this.setState({ hasText: true })
    else this.setState({ hasText: false })

    this.props.onChangeText(value)
  }

  onClear = () => {
    this.props.onChangeText('')
    this.setState({ hasText: false })
    this.input.clear()
  }

  render () {
    const {
      containerStyle,
      inputStyle,
      iconName,
      hasNoIcon,
      isRounded,
      isLight,
      ...props
    } = this.props
    return (
      <Container>
        <StyledTextInput
          {...props}
          ref={c => {
            this.input = c
          }}
          autoCapitalize='none'
          autoCorrect={false}
          onChangeText={this.onChangeText}
          placeholderTextColor={isLight ? 'black' : 'white'}
          underlineColorAndroid='transparent'
          {...{ hasNoIcon, isRounded, isLight }}
        />
        {!this.state.hasText && (
          <IconButton>
            <Icon
              size={20}
              name={iconName || 'search'}
              color={isLight ? 'black' : 'white'}
            />
          </IconButton>
        )}
        {this.state.hasText && (
          <IconButtonTouch onPress={this.onClear}>
            <Icon
              size={20}
              name={'close'}
              color={isLight ? 'black' : 'white'}
            />
          </IconButtonTouch>
        )}
      </Container>
    )
  }
}

export default pure(SearchInput)
