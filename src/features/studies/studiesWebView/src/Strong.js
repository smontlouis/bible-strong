import React from 'react'
import './strong.css'

const Strong = ({ title, code, strongType, phonetique, definition, translatedBy }) => (
  <React.Fragment>
    <hr />
    <div className='block-strong--content'>
      <div className='block-strong--title'>
        {title}
      </div>
      <div>
        [{phonetique}] - {code}
      </div>
    </div>
    <hr />
  </React.Fragment>
)

export default Strong
