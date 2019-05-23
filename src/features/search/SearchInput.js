import React, { Component } from 'react'
import { TouchableOpacity } from 'react-native'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { withTheme } from 'emotion-theming'
import styled from '@emotion/native'

const StyledTextInput = styled.TextInput(({ theme }) => ({
  fontSize: 16,
  color: theme.colors.default
}))

const IconButton = styled.View({
  backgroundColor: 'transparent',
  position: 'absolute',
  right: 16,
  top: 13
})

const IconButtonTouch = IconButton.withComponent(TouchableOpacity)

const Container = styled.View(({ theme }) => ({
  flex: 1,
  paddingTop: 10,
  paddingBottom: 10,
  paddingLeft: 20,
  paddingRight: 35,
  overflow: 'hidden',
  backgroundColor: theme.colors.lightGrey,
  borderBottomWidth: 0,
  borderRadius: 40
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
      theme,
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
          placeholderTextColor={theme.colors.default}
          underlineColorAndroid='transparent'
          {...{ hasNoIcon, isRounded }}
        />
        {!this.state.hasText && (
          <IconButton>
            <Icon
              size={20}
              name={iconName || 'search'}
              color={theme.colors.default}
            />
          </IconButton>
        )}
        {this.state.hasText && (
          <IconButtonTouch onPress={this.onClear}>
            <Icon
              size={20}
              name={'close'}
              color={theme.colors.default}
            />
          </IconButtonTouch>
        )}
      </Container>
    )
  }
}

export default withTheme(SearchInput)
