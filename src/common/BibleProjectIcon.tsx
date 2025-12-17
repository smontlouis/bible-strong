import * as React from 'react'
import Svg, { G, Path } from 'react-native-svg'
import { useTheme } from '@emotion/react'
import { Theme } from '~themes'
/* SVGR has dropped some elements not supported by react-native-svg: title */

function BibleProjectIcon({ color, ...props }: React.SVGProps<SVGSVGElement>) {
  const theme: Theme = useTheme()
  return (
    // @ts-ignore
    <Svg width={30} height={30} viewBox="0 0 195 164" {...props}>
      <G
        // @ts-ignore
        fill={theme.colors[color] || color || theme.colors.primary}
        fillRule="nonzero"
      >
        <Path d="M27 .8C6.3 1 3.027.598 1.927 2.098.827 3.598 1 18.7 1 68.3c0 59.8.1 64.1 1.7 65.3 1.4 1 7.9 1.3 28.6 1.4H58v-14H16V15h75v75h15V15h74v106h-42v14h26.8c20.6-.1 27.1-.4 28.5-1.4 1.6-1.2 1.7-5.5 1.7-65.3 0-50-.3-64.3-1.3-65.6-1.1-1.7-6.2-1.8-72.2-2C82.4.6 39.9.6 27 .8z" />
        <Path d="M32 38v7h42V31H32zM122 38v7h42V31h-42zM122 68v7h42V61h-42zM122 98v7h42V91h-42zM32 98v7h42V91H32zM32 68v7h42V61H32zM75 128v7h46v-14H75z" />
        <Path d="M97.547 106.163h-7v57h14v-57z" />
      </G>
    </Svg>
  )
}

export default BibleProjectIcon
