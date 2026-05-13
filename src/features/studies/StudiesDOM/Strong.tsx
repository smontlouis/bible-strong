import React from 'react'
import ArrowRight from './ArrowRight'
import './strong.css'

interface StrongProps {
  title: string
  code?: string
  codeStrong?: string
  strongType?: string
  phonetique?: string
  definition?: string
  translatedBy?: string
  original?: string
}

const Strong = ({ title, code, codeStrong, phonetique, original }: StrongProps) => (
  <>
    <div className="block-strong--content">
      <div className="block-strong--title">{title}</div>
      <div className="block-strong--desc">
        [{phonetique}] - {code || codeStrong} - {original}
      </div>
      <div className="block-strong--arrow">
        <ArrowRight color="rgb(9,132,227)" />
      </div>
      <div className="block-delete" />
    </div>
  </>
)

export default Strong
