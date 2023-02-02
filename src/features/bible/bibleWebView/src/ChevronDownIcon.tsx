import { memo } from 'react'

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="prefix__feather prefix__feather-chevron-down"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default memo(SvgComponent)
