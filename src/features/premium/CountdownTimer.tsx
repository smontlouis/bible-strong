import React, { useEffect, useState } from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const CountdownTimer = () => {
  const calculateTimeLeft = () => {
    const difference = +new Date('2020-08-01') - +new Date()
    let timeLeft = {}

    if (difference > 0) {
      timeLeft = {
        jours: Math.floor(difference / (1000 * 60 * 60 * 24)),
        h: Math.floor((difference / (1000 * 60 * 60)) % 24),
        min: Math.floor((difference / 1000 / 60) % 60),
        s: Math.floor((difference / 1000) % 60),
      }
    }

    return timeLeft
  }

  const [timeLeft, setTimeLeft] = useState<{
    [x: string]: number
    jours?: string
    h?: string
    min?: string
    s?: string
  }>(calculateTimeLeft())

  useEffect(() => {
    setTimeout(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)
  })

  return (
    <Text color="quart">
      Disponible gratuitement dans{' '}
      {Object.keys(timeLeft).map((interval: string) => {
        if (!timeLeft[interval]) {
          return null
        }

        return (
          <>
            {timeLeft[interval]} {interval}{' '}
          </>
        )
      })}
    </Text>
  )
}

export default CountdownTimer
