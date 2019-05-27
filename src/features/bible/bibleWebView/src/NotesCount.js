import { h } from 'preact'
import picostyle from 'picostyle'
const styled = picostyle(h)

const scaleFontSize = (value, scale) => `${value + (scale * 0.1 * value)}px` // Scale

const SvgContainer = styled('svg')(({ settings: { fontSizeScale } }) => ({
  fontSize: scaleFontSize(20, fontSizeScale),
  padding: '0 10px'
}))

const NotesCount = ({ count, settings, onClick }) => (
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
    <path d='M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' />
    <polyline points='13 2 13 9 20 9' />
    <text x='8' y='20' font-size='13px' font-family='arial'>{ count }</text>
  </SvgContainer>
)

export default NotesCount
