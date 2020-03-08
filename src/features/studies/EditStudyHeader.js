import React from 'react'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Header from '~common/Header'

const HeaderBox = styled(Box)({
  alignItems: 'center',
  paddingLeft: 15,
  paddingRight: 15
})

const ValidateIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.success
}))

const EditHeader = ({ isReadOnly, setReadOnly, title, setTitlePrompt }) => {
  if (isReadOnly) {
    return <Header hasBackButton title={title} onTitlePress={setTitlePrompt} />
  }

  return (
    <HeaderBox>
      <Box row height={50} center>
        <Box flex justifyContent="center">
          <Link
            onPress={setReadOnly}
            underlayColor="transparent"
            style={{ marginRight: 15 }}>
            <ValidateIcon name="check" size={25} />
          </Link>
        </Box>
      </Box>
    </HeaderBox>
  )
}

export default pure(EditHeader)
