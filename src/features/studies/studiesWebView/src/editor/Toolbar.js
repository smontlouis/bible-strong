import React from 'react'

const Toolbar = () => (
  <div id='toolbar'>
    <span className='ql-formats'>
      <select className='ql-header' defaultValue=''>
        <option />
        <option value='1' />
        <option value='2' />
      </select>
    </span>

    <span className='ql-formats'>
      <select className='ql-background' />
      <button className='ql-blockquote' />
    </span>

    <span className='ql-formats'>
      <button className='ql-bold' />
      <button className='ql-italic' />
      <button className='ql-underline' />
    </span>

    <span className='ql-formats'>
      <button className='ql-list' value='ordered' />
      <button className='ql-list' value='bullet' />
    </span>

    <span className='ql-formats'>
      <button className='ql-inline-verse' />
      <button className='ql-inline-strong' />
      <button className='ql-block-verse'>vers</button>
      <button className='ql-block-strong'>stron</button>
    </span>
  </div>
)

export default Toolbar
