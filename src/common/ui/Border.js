import styled from '@emotion/native'
import Box from './Box'

const Border = styled(Box)(({ theme }) => ({
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border
}))

export default Border

const Thumb = ({}) => (
  <div>
    <img className="thumb_img" src={imgSrc} />
    <div className="thumb_category">{category}</div>
    <div className="thumb_title">{title}</div>
    <div></div>
  </div>
)
