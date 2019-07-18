import React from 'react'

const Toolbar = () => (
  <div id='toolbar'>
    <div className='ql-toolbar-wrapper'>
      <button className='ql-bold' />
      <button className='ql-italic' />
      <button className='ql-underline' />
      <select className='ql-background' />
      <button className='ql-blockquote' />

      <button className='ql-list' value='ordered' />
      <button className='ql-list' value='bullet' />
    </div>
    <div className='ql-toolbar-wrapper'>
      <select className='ql-header' defaultValue=''>
        <option />
        <option value='1' />
        <option value='2' />
      </select>

      {/* <div className='ql-formats'> */}
      <button className='ql-inline-verse' />
      <button className='ql-inline-strong' />
      <button className='ql-block-verse'>vers</button>
      <button className='ql-block-strong'>stron</button>
      {/* </div> */}

      {/* <div className='ql-formats'> */}
      {/* </div> */}

    </div>

  </div>
)

export default Toolbar
