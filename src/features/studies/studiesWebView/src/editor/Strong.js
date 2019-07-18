import React from 'react'
import './strong.css'

const Strong = ({ title, code, strongType, phonetique, definition, translatedBy }) => (
  <React.Fragment>
    <div className='block-strong--content'>
      <div className='block-strong--title'>
        {title}
      </div>
      <div>
        [{phonetique}] - {code}
      </div>
    </div>
  </React.Fragment>
)

export default Strong
