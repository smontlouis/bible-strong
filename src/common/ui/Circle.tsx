import styled from '~styled/index'

const Circle = styled.View<{
  isSelected: boolean
  color: string
  size: number
}>(({ isSelected, color, size, theme }) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: color,
  borderWidth: 2,
  borderColor: isSelected ? theme.colors.primary : theme.colors.opacity5,
  marginLeft: 10,
}))

export default Circle
