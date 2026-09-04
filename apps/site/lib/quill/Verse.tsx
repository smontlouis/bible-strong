import React from 'react'
import { RiCloseLine } from 'react-icons/ri'

const Verse = ({
  title,
  content,
  version,
}: {
  title: string
  content: string
  version: string
}) => (
  <React.Fragment>
    <div className="block-verse--wrapper">
      <div className="block-verse--content">{content}</div>
      <div className="block-verse--bottom">
        <div className="block-verse--verse">{title}</div>
        <div className="block-verse--version">{version}</div>
      </div>
      <div className="block-delete">
        <RiCloseLine />
      </div>
    </div>
  </React.Fragment>
)

export default Verse
