import { defineConfig } from 'wmr'
import rollupInlineSource from './inlineSourcePlugin.js'
import htmlMinifier from 'rollup-plugin-html-minifier'
import { visualizer } from 'rollup-plugin-visualizer'

import path from 'path'
const htmlpath = path.resolve('./dist/index.html')

// Full list of options: https://wmr.dev/docs/configuration
export default defineConfig({
  alias: {
    react: 'preact/compat',
    'react-dom': 'preact/compat',
  },
  plugins: [
    rollupInlineSource({
      options: {
        compress: false,
        rootpath: path.resolve('./dist'),
      },
    }),
    htmlMinifier({
      options: {
        collapseWhitespace: true,
        collapseInlineTagWhitespace: true,
        minifyJS: true,
      },
    }),
    visualizer(),
  ],
})
