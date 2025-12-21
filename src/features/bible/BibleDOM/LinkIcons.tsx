import React from 'react'

interface IconProps {
  size?: number
  color?: string
  onClick?: () => void
}

// Brand colors from linkTypeConfig
const COLORS = {
  youtube: '#FF0000',
  twitter: '#000',
  instagram: '#E4405F',
  tiktok: '#000000',
  vimeo: '#1AB7EA',
  spotify: '#1DB954',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  github: '#333333',
  website: '#888888',
}

// YouTube icon (brand - filled play button shape)
export const YouTubeIcon = ({ size = 24, color = COLORS.youtube, onClick }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} onClick={onClick}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

// Twitter/X icon (brand - X shape)
export const TwitterIcon = ({ size = 24, color = COLORS.twitter, onClick }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} onClick={onClick}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

// Instagram icon (brand - camera outline)
export const InstagramIcon = ({ size = 24, color = COLORS.instagram, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

// TikTok icon (Feather music style)
export const TikTokIcon = ({ size = 24, color = COLORS.tiktok, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

// Vimeo icon (Feather video style)
export const VimeoIcon = ({ size = 24, color = COLORS.vimeo, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
)

// Spotify icon (Feather music style - different from TikTok)
export const SpotifyIcon = ({ size = 24, color = COLORS.spotify, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M8 15c4-1.5 8 0 8 0" />
    <path d="M7 12c5-2 10 0 10 0" />
    <path d="M6 9c6-2.5 12 0 12 0" />
  </svg>
)

// Facebook icon (Feather style)
export const FacebookIcon = ({ size = 24, color = COLORS.facebook, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

// LinkedIn icon (Feather style)
export const LinkedInIcon = ({ size = 24, color = COLORS.linkedin, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
)

// GitHub icon (Feather style)
export const GitHubIcon = ({ size = 24, color = COLORS.github, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
)

// Link icon (Feather style - generic website)
export const LinkIcon = ({ size = 24, color = COLORS.website, onClick }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

// Lookup object for getting icons by link type
export const linkTypeIcons: Record<string, React.FC<IconProps>> = {
  youtube: YouTubeIcon,
  twitter: TwitterIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  vimeo: VimeoIcon,
  spotify: SpotifyIcon,
  facebook: FacebookIcon,
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  website: LinkIcon,
}

// Helper to get icon component by link type
export const getLinkTypeIconComponent = (linkType: string): React.FC<IconProps> => {
  return linkTypeIcons[linkType] || LinkIcon
}

// Helper to get default color for link type
export const getLinkTypeColor = (linkType: string): string => {
  return COLORS[linkType as keyof typeof COLORS] || COLORS.website
}
