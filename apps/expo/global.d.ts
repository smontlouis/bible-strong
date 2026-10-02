// global.d.ts
declare module 'trunc-html' {
  const truncHTML: (x: string, limit: number) => { html: string; text: string }
  export default truncHTML
}

declare module '~assets/bible_versions/bible-vod.json' {
  const VOD: { [x: string]: string }
  export default VOD
}

// Per-icon lucide modules (see src/features/study-assistant/lucideIcons.ts).
declare module 'lucide-react/dist/esm/icons/*.mjs' {
  const icon: import('lucide-react').LucideIcon
  export default icon
}
