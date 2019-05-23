import styled from '@emotion/native'

const Container = styled.SafeAreaView(props => ({
  position: 'relative',
  flex: 1,
  backgroundColor: props.grey ? 'rgba(0,0,0,0.05)' : 'white',
  padding: props.padding
}))

export default Container
