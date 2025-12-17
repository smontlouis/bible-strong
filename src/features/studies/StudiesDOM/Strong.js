import React from 'react'
import ArrowRight from './ArrowRight'
import './strong.css'

const Strong = ({ title, code, phonetique, original }) => (
  <>
    <div className="block-strong--content">
      <div className="block-strong--title">{title}</div>
      <div className="block-strong--desc">
        [{phonetique}] - {code} - {original}
      </div>
      <div className="block-strong--arrow">
        <ArrowRight color="rgb(9,132,227)" />
      </div>
      <div className="block-delete" />
    </div>
  </>
)

export default Strong
