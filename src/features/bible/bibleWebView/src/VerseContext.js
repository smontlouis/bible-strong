import React from 'react'

const VerseContext = React.createContext({})

export const VerseProvider = VerseContext.Provider
export const VerseConsumer = VerseContext.Consumer

export default VerseContext
