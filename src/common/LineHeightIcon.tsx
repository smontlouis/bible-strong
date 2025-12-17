import Box, { VStack } from './ui/Box'

export const LineHeightIcon = ({ isSelected, gap }: { isSelected: boolean; gap: number }) => {
  const color = isSelected ? 'primary' : 'grey'
  const width = 18
  const height = 2
  return (
    <VStack alignItems="center" justifyContent="center" gap={gap} width={55} height={18}>
      <Box borderRadius={10} width={width} height={height} backgroundColor={color} />
      <Box borderRadius={10} width={width} height={height} backgroundColor={color} />
      <Box borderRadius={10} width={width} height={height} backgroundColor={color} />
    </VStack>
  )
}
