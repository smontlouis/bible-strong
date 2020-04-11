import React from 'react'
import FastImage from 'react-native-fast-image'
import ProgressCircle from 'react-native-progress/Circle'
import { useTheme } from 'emotion-theming'

import styled from '~styled'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import Link from '~common/Link'
import FlatList from '~common/ui/FlatList'
import { useComputedPlanItems } from '../plan.hooks'
import { ComputedPlanItem } from 'src/common/types'
import { FeatherIcon } from '~common/ui/Icon'
import { Theme } from '~themes'
import Spacer from '~common/ui/Spacer'

export const CircleImage = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 4,
  right: 0,
  left: 4,
  bottom: 0,
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: theme.colors.lightGrey,
}))

const PlanItem = ({
  id,
  title,
  image,
  description,
  status,
  progress,
  author,
}: ComputedPlanItem) => {
  const theme: Theme = useTheme()
  return (
    <Link
      route="Plan"
      params={{
        plan: {
          id,
          title,
          image,
          description,
          status,
          progress,
          author,
        },
      }}
    >
      <Box
        lightShadow
        borderRadius={35}
        paddingHorizontal={13}
        paddingVertical={10}
        row
        center
        {...(status === 'Progress' && {
          borderWidth: 2,
          borderColor: 'primary',
        })}
        {...(status === 'Completed' && {
          borderWidth: 2,
          borderColor: 'success',
        })}
      >
        <ProgressCircle
          size={40}
          progress={progress}
          borderWidth={0}
          color={
            status === 'Completed' ? theme.colors.success : theme.colors.primary
          }
          unfilledColor={theme.colors.lightGrey}
          thickness={2}
        >
          <CircleImage center>
            {image && (
              <FastImage
                style={{ width: 32, height: 32 }}
                source={{
                  uri: image,
                }}
              />
            )}
          </CircleImage>
        </ProgressCircle>
        <Box flex paddingLeft={10}>
          <Text title>{title}</Text>
        </Box>
        <Box
          backgroundColor={status === 'Completed' ? 'success' : 'primary'}
          borderRadius={15}
          size={30}
          center
          marginLeft={20}
        >
          <FeatherIcon
            name="chevron-right"
            color="reverse"
            size={17}
            style={{ marginLeft: 2 }}
          />
        </Box>
      </Box>
    </Link>
  )
}
const PlanScreen = () => {
  const plans = useComputedPlanItems()
  return (
    <Container>
      <Header title="Mes Plans" hasBackButton />
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20 }}
        bg="lightGrey"
        data={plans}
        renderItem={({ item }: { item: ComputedPlanItem }) => (
          <PlanItem {...item} />
        )}
        keyExtractor={(item: ComputedPlanItem) => item.id}
        ItemSeparatorComponent={Spacer}
      />
    </Container>
  )
}

export default PlanScreen
