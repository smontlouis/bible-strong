import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '../../../../../redux/modules/reducer'

const SvgContainer = styled<RootStyles>('svg')(({ settings: { fontSizeScale } }) => ({}))

const Div = styled<RootStyles>('div')(({ settings: { theme } }) => ({
  position: 'relative',
  display: 'inline-block',
  transform: 'translateY(5px)',
  marginRight: '10px',
}))

const Count = styled<RootStyles>('div')(({ settings: { theme, colors } }) => ({
  background: colors[theme].primary,
  position: 'absolute',
  width: '15px',
  height: '15px',
  borderRadius: '15px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'arial',
  fontSize: '13px',
  fontWeight: 'bold',
  color: 'white',
  bottom: '0',
  right: '0px',
}))

interface Props {
  count: number
  settings: RootState['user']['bible']['settings']
  onClick: () => void
}

const NotesCount = ({ count, settings, onClick }: Props) => (
  <Div settings={settings}>
    <SvgContainer
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      settings={settings}
      onClick={onClick}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </SvgContainer>
    <Count settings={settings}>{count}</Count>
  </Div>
)

export default NotesCount
