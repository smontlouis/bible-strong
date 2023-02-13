import styled from '@emotion/native'

const Container = styled.View<{ isExpanded: boolean }>(
  ({ isExpanded, theme }) => ({
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    height: 60,
    paddingLeft: 10,
    paddingRight: 10,
    pointerEvents: 'box-none',
    zIndex: 1,

    ...(isExpanded && {
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
      height: 'auto',
      minHeight: 120,
      backgroundColor: theme.colors.reverse,
      marginLeft: 0,
      marginRight: 0,
      bottom: 0,
      paddingBottom: 20,
    }),
  })
)

export default Container
