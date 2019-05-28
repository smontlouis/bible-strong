import { h } from 'preact'
import picostyle from 'picostyle'

import { getColors } from '../../../../themes/getColors'

const styled = picostyle(h)

const SvgContainer = styled('svg')(({ settings: { fontSizeScale } }) => ({
}))

const Div = styled('div')(({ settings: { theme } }) => ({
  position: 'relative',
  display: 'inline-block',
  transform: 'translateY(5px)',
  marginRight: '10px'
}))

const Count = styled('div')(({ settings: { theme } }) => ({
  background: getColors[theme].primary,
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
  right: '0px'
}))

const NotesCount = ({ count, settings, onClick }) => (
  <Div settings={settings}>
    <SvgContainer
      width='24'
      height='24'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      stroke-width='2'
      stroke-linecap='round'
      stroke-linejoin='round'
      settings={settings}
      onClick={onClick}
    >
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
      <line x1='16' y1='13' x2='8' y2='13' />
      <line x1='16' y1='17' x2='8' y2='17' />
      <polyline points='10 9 9 9 8 9' />
    </SvgContainer>
    <Count settings={settings}>
      {count}
    </Count>
  </Div>

)

export default NotesCount
