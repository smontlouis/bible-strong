import * as Icon from '@expo/vector-icons'
import { styled } from 'goober'
import { RootState } from '~redux/modules/reducer'
import { RootStyles } from './BibleDOMWrapper'
import { isDarkTheme } from './utils'
import { getDisabledStyles } from './disabledStyles'

const Div = styled('span')<RootStyles & { isDisabled?: boolean }>(
  ({ settings: { theme, colors }, isDisabled }) => ({
    backgroundColor: colors[theme].reverse,
    boxShadow: isDarkTheme(theme)
      ? `0 0 10px 0 rgba(255, 255, 255, 0.1)`
      : `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
    borderRadius: '8px',
    padding: '4px 8px 4px 6px',
    wordBreak: 'break-word',
    marginRight: '4px',
    marginLeft: '4px',
    position: 'relative',
    display: 'inline-block',

    '&:active': {
      opacity: 0.6,
    },
    ...getDisabledStyles(isDisabled),
  })
)

const Count = styled<RootStyles>('div')(({ settings: { theme, colors } }) => ({
  background: colors[theme].grey,
  position: 'absolute',
  width: '12px',
  height: '12px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'arial',
  fontSize: '10px',
  color: colors[theme].reverse,
  bottom: '0',
  right: '0px',
}))

interface Props {
  count: number
  settings: RootState['user']['bible']['settings']
  onClick: () => void
  isDisabled?: boolean
}

const NotesCount = ({ count, settings, onClick, isDisabled }: Props) => {
  return (
    <Div settings={settings} onClick={() => onClick()} isDisabled={isDisabled}>
      <Icon.Ionicons
        color={settings.colors[settings.theme].quart}
        name="document-text-outline"
        size={16}
      />
      <Count settings={settings}>{count}</Count>
    </Div>
  )
}

export default NotesCount
