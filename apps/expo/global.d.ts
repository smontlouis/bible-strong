// global.d.ts
declare module 'trunc-html' {
  const truncHTML: (x: string, limit: number) => { html: string; text: string }
  export default truncHTML
}

declare module '~assets/bible_versions/bible-vod.json' {
  const VOD: { [x: string]: string }
  export default VOD
}
