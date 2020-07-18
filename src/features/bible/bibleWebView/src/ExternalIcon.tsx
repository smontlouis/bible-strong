import * as React from 'react'

function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      style={{ marginLeft: 10 }}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      data-tags="external-link"
      {...props}
    >
      <path
        d="M17 13v6c0 .276-.111.525-.293.707S16.276 20 16 20H5c-.276 0-.525-.111-.707-.293S4 19.276 4 19V8c0-.276.111-.525.293-.707S4.724 7 5 7h6a1 1 0 000-2H5a2.997 2.997 0 00-3 3v11a2.997 2.997 0 003 3h11a2.997 2.997 0 003-3v-6a1 1 0 00-2 0zm-6.293 1.707L20 5.414V9a1 1 0 002 0V3a.995.995 0 00-.292-.706l-.002-.002A.996.996 0 0021 2h-6a1 1 0 000 2h3.586l-9.293 9.293a.999.999 0 101.414 1.414z"
        fill="#444"
      />
    </svg>
  )
}

export default SvgComponent
