import { styled } from 'goober'
import { scaleFontSize } from './scaleFontSize'
import { ENTER_READONLY_MODE } from './dispatch'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'
import { useDispatch } from './DispatchProvider'
import { useTranslations } from './TranslationsContext'
import { getDisabledStyles } from './disabledStyles'

const Tag = styled('div')<RootStyles & { isDisabled?: boolean }>(({ settings: { theme, colors, fontSizeScale }, isDisabled }) => ({
  fontFamily: 'arial',
  padding: '2px 8px',
  borderRadius: '40px',
  color: colors[theme].primary,
  backgroundColor: colors[theme].opacity5,
  fontSize: scaleFontSize(12, fontSizeScale),
  marginLeft: '5px',
  display: 'inline-flex',
  cursor: 'pointer',
  '&:active': {
    opacity: 0.5,
  },
  ...getDisabledStyles(isDisabled),
}))

interface Props {
  settings: RootState['user']['bible']['settings']
  isDisabled?: boolean
}

const CloseContextTag = ({ settings, isDisabled }: Props) => {
  const dispatch = useDispatch()
  const translations = useTranslations()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: ENTER_READONLY_MODE })
  }

  return (
    <Tag settings={settings} onClick={handleClick} isDisabled={isDisabled}>
      {translations.closeContext}
    </Tag>
  )
}

export default CloseContextTag
