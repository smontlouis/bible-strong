import { Link } from '@tanstack/react-router'
import type { AnchorHTMLAttributes } from 'react'
import { siteAddress } from '@/features/resources/pageNavigation'

const NOT_MARKED = { className: '' }

/**
 * A link written with its address, as the pages build them. Inside the site it is the router's,
 * which loads the next page when the reader comes near it; elsewhere it is a plain link.
 */
export default function SiteLink({
  href,
  ...link
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const address = siteAddress(href)
  if (!address) return <a href={href} {...link} />
  return (
    <Link
      to={address.to}
      search={address.search}
      hash={address.hash}
      activeProps={NOT_MARKED}
      {...link}
    />
  )
}
