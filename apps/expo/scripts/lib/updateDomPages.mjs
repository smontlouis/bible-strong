const pageName = /[0-9a-f]{32}\.html/g
const pageResource = /\.\/([0-9a-f]{32}\.(?:js|css))/g

const assetName = asset => asset.path.split('/').pop()

/**
 * What a platform's update needs and does not list: the DOM pages its bundle opens, and what those
 * pages load. A device only receives what the metadata lists, and a page it lacks ends on
 * `net::ERR_FILE_NOT_FOUND` there, while the file itself sits in `dist` for the other platform.
 */
export const findMissingDomAssets = ({ assets, bundle, readPage }) => {
  const listed = new Set(assets.map(assetName))
  const pages = [...new Set(bundle.toString('latin1').match(pageName) ?? [])]
  const missing = pages.filter(page => !listed.has(page))

  for (const page of pages.filter(page => listed.has(page))) {
    for (const [, resource] of readPage(page).matchAll(pageResource)) {
      if (!listed.has(resource)) missing.push(resource)
    }
  }

  return [...new Set(missing)]
}
