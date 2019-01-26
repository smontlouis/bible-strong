import styled from '@emotion/native'
import { bindStyles } from '@helpers/styledProps'
import theme from '../../themes/default'

const Text = styled.Text(props => {
  const s = bindStyles(theme)
  return {
    fontFamily: s.fontFamily(props),
    color: s.colors(props),
    fontSize: props.fontSize
  }
})

Text.defaultProps = {
  fontFamily: 'text',
  colors: 'default'
}

export default Text
