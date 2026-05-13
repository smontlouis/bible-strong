import React from 'react'
import ArrowRight from './ArrowRight'
import './strong.css'

interface StrongProps {
  title: string
  code?: string
  phonetique: string
  original: string
  [key: string]: any
}

const Strong = ({ title, code, phonetique, original }: StrongProps) => (
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
