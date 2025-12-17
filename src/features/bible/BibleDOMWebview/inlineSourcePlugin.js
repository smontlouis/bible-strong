import { inlineSource } from 'inline-source'
import { createFilter } from '@rollup/pluginutils'
import path from 'path'
import fs from 'fs'
const htmlpath = path.resolve('./dist/index.html')

export default ({
  include = '*.html',
  exclude = undefined,
  filter = createFilter(include, exclude),
  options = {},
} = {}) => ({
  name: 'inline-source',

  writeBundle(outputOptions, bundle) {
    Object.values(bundle).forEach(async file => {
      if (file.type !== 'asset' || !filter(file.fileName)) return
      const data = (file.source = await inlineSource(file.source.toString(), options))
      fs.writeFile(`${outputOptions.dir}/${file.fileName}`, data, (err, data) => {
        if (err) return console.log(err)
      })
    })
  },
})
