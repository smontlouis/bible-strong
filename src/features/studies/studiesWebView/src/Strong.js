import React from 'react'
import ArrowRight from './ArrowRight'
import './strong.css'

const Strong = ({ title, code, phonetique, original }) => (
  <React.Fragment>
    <div className='block-strong--content'>
      <div className='block-strong--title'>
        {title}
      </div>
      <div className='block-strong--desc'>
        [{phonetique}] - {code}
      </div>
      <div className='block-strong--original'>
        {original}
      </div>
      <div className='block-strong--arrow'>
        <ArrowRight />
      </div>
    </div>
    {/* <div className='block-delete' /> */}
  </React.Fragment>
)

export default Strong
