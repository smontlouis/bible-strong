import type { ComponentProps } from 'react'

import Header from '~common/Header'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import ResourceUnavailableView from './ResourceUnavailableView'

type Props = ComponentProps<typeof ResourceUnavailableView> & {
  headerTitle: string
  hasBackButton?: boolean
  isFormSheet?: boolean
  onBackPress?: () => void
}

const ResourceUnavailableScreen = ({
  headerTitle,
  hasBackButton,
  isFormSheet = false,
  onBackPress,
  ...unavailableProps
}: Props) => (
  <FormSheetScreen isFormSheet={isFormSheet}>
    <Box flex bg="reverse">
      <Header hasBackButton={hasBackButton} title={headerTitle} onCustomBackPress={onBackPress} />
      <ResourceUnavailableView {...unavailableProps} />
    </Box>
  </FormSheetScreen>
)

export default ResourceUnavailableScreen
