import * as React from 'react'

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="prefix__feather prefix__feather-minus-circle"
      {...props}
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M8 12h8" />
    </svg>
  )
}

export default SvgComponent
