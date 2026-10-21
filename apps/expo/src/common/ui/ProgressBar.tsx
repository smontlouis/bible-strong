import React from 'react'
import Box from './Box'

export interface ProgressBarProps {
  progress: number
}

export const ProgressBar = ({ progress }: ProgressBarProps) => {
  return (
    <Box className="border-light-primary overflow-hidden border-continuous p-[0px] border-[0px] rounded-full bg-reverse">
      <Box className="overflow-hidden border-continuous h-[8px] rounded-full bg-light-grey">
        <Box
          className="overflow-hidden border-continuous rounded-full bg-primary absolute top-[0px] right-[0px] bottom-[0px] left-[0px]"
          style={{ width: `${progress * 100}%` }}
        />
      </Box>
    </Box>
  )
}
