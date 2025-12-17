import React from 'react'
import ArrowRight from './ArrowRight'
import './verse.css'

const Verse = ({ title, content, version }) => (
  <React.Fragment>
    <div className="block-verse--wrapper">
      <div className="block-verse--content">{content}</div>
      <div className="block-verse--bottom">
        <div className="block-verse--verse">{title}</div>
        <div className="block-verse--version">{version}</div>
      </div>
      <div className="block-verse--arrow">
        <ArrowRight color="rgba(48, 51, 107,1.0)" />
      </div>
      <div className="block-delete" />
    </div>
  </React.Fragment>
)

export default Verse
