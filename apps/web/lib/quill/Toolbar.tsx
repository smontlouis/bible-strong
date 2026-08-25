import { Box, Tooltip } from '@chakra-ui/react'
import React from 'react'
import { AiOutlineLine, AiOutlineLink } from 'react-icons/ai'
import { FiBox } from 'react-icons/fi'

const Toolbar = () => {
  return (
    <div id="toolbar">
      <span className="ql-formats">
        <select
          className="ql-header"
          defaultValue={''}
          onChange={(e) => e.persist()}
        >
          <option />
          <option value="1" />
          <option value="2" />
        </select>
      </span>
      <span className="ql-formats">
        <button className="ql-bold" />
        <button className="ql-italic" />
        <button className="ql-underline" />
      </span>
      <span className="ql-formats">
        <button className="ql-list" value="ordered"></button>
        <button className="ql-list" value="bullet"></button>
      </span>
      <span className="ql-formats">
        <select className="ql-color"></select>
        <select className="ql-background"></select>
      </span>
      <Box className="ql-formats" borderRadius="full" bg="lightQuint">
        <Tooltip
          hasArrow
          label="Insérer un lien verset"
          aria-label="Lien verset"
        >
          <button className="ql-inlineVerse">
            <Box as={AiOutlineLink} w="18px" h="18px" color="quint" />
          </button>
        </Tooltip>
        <Tooltip
          hasArrow
          label="Insérer un bloc verset"
          aria-label="Bloc verset"
        >
          <button className="ql-bibleVerse">
            <Box as={FiBox} w="18px" h="18px" color="quint" />
          </button>
        </Tooltip>
      </Box>

      <Box className="ql-formats" borderRadius="full" bg="lightPrimary">
        <Tooltip
          hasArrow
          label="Insérer un lien strong"
          aria-label="Lien strong"
        >
          <button className="ql-inlineStrong">
            <Box as={AiOutlineLink} w="18px" h="18px" color="primary" />
          </button>
        </Tooltip>
        <Tooltip
          hasArrow
          label="Insérer un bloc strong"
          aria-label="Bloc strong"
        >
          <button className="ql-bibleStrong">
            <Box as={FiBox} w="18px" h="18px" color="primary" />
          </button>
        </Tooltip>
      </Box>

      <span className="ql-formats">
        <button className="ql-divider">
          <Box as={AiOutlineLine} w="18px" h="18px" />
        </button>
      </span>
    </div>
  )
}

export default Toolbar
