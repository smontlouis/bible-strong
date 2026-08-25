import React from 'react'
import { RiCloseLine } from 'react-icons/ri'

interface Props {
  title: string
  codeStrong: string
  phonetique: string
  original: string
}
const Strong = ({ title, codeStrong, phonetique, original }: Props) => (
  <>
    <div className="block-strong--content">
      <div className="block-strong--original">{original}</div>
      <div className="block-strong--title">{title}</div>
      <div className="block-strong--desc">
        [{phonetique}] - {codeStrong}
      </div>

      <div className="block-delete">
        <RiCloseLine />
      </div>
    </div>
  </>
)

export default Strong
