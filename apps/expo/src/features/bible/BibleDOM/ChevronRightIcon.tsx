function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="0.8em"
      height="0.8em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="prefix__feather prefix__feather-chevron-right"
      {...props}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export default SvgComponent
