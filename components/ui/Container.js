import styled from '@emotion/native'

const Container = styled.SafeAreaView(props => ({
  flex: 1,
  backgroundColor: props.grey ? 'rgba(0,0,0,0.05)' : 'white'
}))

export default Container
