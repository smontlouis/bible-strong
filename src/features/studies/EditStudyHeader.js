import React from 'react'
import { Platform } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import Header from '~common/Header'
import IconDropDown from '~assets/images/IconDropDown'
import QuoteIcon from '~assets/images/QuoteIcon'
import BackgroundIcon from '~assets/images/BackgroundIcon'
import ColorIcon from '~assets/images/ColorIcon'

import { TouchableOpacity } from 'react-native-gesture-handler'

const HeaderBox = styled(Box)(({ theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  alignItems: 'center',
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  paddingLeft: 15,
  paddingRight: 15
}))

const ValidateIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.success
}))

const MUIcon = styled(Icon.MaterialIcons)(({ theme }) => ({
  color: theme.colors.grey,
  marginLeft: 10,
  marginRight: 10
}))

const FormatIcon = styled(Icon.Feather)(({ theme, isSelected }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default
}))

const PlusIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
  marginLeft: 10,
  marginRight: 0
}))

const headerTitle = {
  0: 'Normal',
  1: 'Titre',
  2: 'Sous-titre'
}

const EditHeader = ({
  isReadOnly,
  setReadOnly,
  title,
  activeFormats,
  dispatchToWebView,
  openHeaderModal,
  openBlockModal,
  openColorModal,
  setTitlePrompt
}) => {
  if (isReadOnly) {
    return <Header hasBackButton title={title} onTitlePress={setTitlePrompt} />
  }

  const getHeaderTitle = () => {
    if (!activeFormats['header']) {
      return headerTitle[0]
    } else {
      return headerTitle[activeFormats['header']]
    }
  }
  return (
    <HeaderBox>
      <Box row height={50} center>
        <Box flex justifyContent='center'>
          <Link onPress={setReadOnly} underlayColor='transparent' style={{ marginRight: 15 }}>
            <ValidateIcon
              name={'check'}
              size={25}
            />
          </Link>
        </Box>
        <TouchableOpacity onPress={openHeaderModal}>
          <Box row center width={100}>
            <Text fontSize={16} flex bold color={activeFormats['header'] ? 'primary' : 'default'}>{getHeaderTitle()}</Text>
            <IconDropDown color={activeFormats['header'] ? 'primary' : 'default'} />
          </Box>
        </TouchableOpacity>
        <Box flex />
        <Box row alignItems='center'>
          <MUIcon name='undo' size={25} onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDO' })} />
          <MUIcon name='redo' size={25} onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'REDO' })} />
          <PlusIcon name='plus' size={25} onPress={openBlockModal} />
        </Box>
      </Box>
      <Box row justifyContent='space-between' height={50} center>
        <FormatIcon
          isSelected={activeFormats['bold']}
          name='bold'
          size={20}
          onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'BOLD', value: !activeFormats['bold'] })}
        />
        <FormatIcon
          isSelected={activeFormats['italic']}
          name='italic'
          size={20}
          onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'ITALIC', value: !activeFormats['italic'] })}
        />
        <FormatIcon
          isSelected={activeFormats['underline']}
          name='underline'
          size={20}
          onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'UNDERLINE', value: !activeFormats['underline'] })}
        />
        <TouchableOpacity
          style={{ borderRadius: 2 }}
          onPress={() => openColorModal('background')}
        >
          <BackgroundIcon
            color={activeFormats['background']}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ borderRadius: 2 }}
          onPress={() => openColorModal('color')}
        >
          <ColorIcon
            color={activeFormats['color']}
          />
        </TouchableOpacity>
        <TouchableOpacity
          underlayColor={'rgba(0,0,0,0.25)'}
          style={{ borderRadius: 2 }}
          onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'BLOCKQUOTE', value: !activeFormats['blockquote'] })}
        >
          <QuoteIcon
            color={activeFormats['blockquote'] ? 'primary' : 'default'}
          />
        </TouchableOpacity>
        <FormatIcon
          isSelected={activeFormats['list'] === 'bullet'}
          name='list'
          size={20}
          onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'LIST', value: activeFormats['list'] === 'bullet' ? false : 'bullet' })}
        />
        <FormatIcon
          isSelected={activeFormats['list'] === 'ordered'}
          name='list'
          size={20}
          onPress={() => dispatchToWebView('TOGGLE_FORMAT', { type: 'LIST', value: activeFormats['list'] === 'ordered' ? false : 'ordered' })}
        />
      </Box>
    </HeaderBox>
  )
}

export default pure(EditHeader)
