const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')

// the path(s) that should be cleaned
let pathsToClean = ['build/*.*']
module.exports = {
  entry: {
    viewer: './src/componentViewer.js',
    editor: './src/componentEditor.js'
  },
  output: {
    path: path.join(__dirname, './build'),
    filename: '[name].bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.js$/,
        include: [path.resolve(__dirname, 'src')],
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                'env',
                {
                  targets: {
                    browsers: ['last 2 versions', 'safari >= 7']
                  }
                }
              ],
              'react',
              'stage-2'
            ],
            plugins: ['babel-plugin-transform-object-rest-spread'],
            babelrc: false
          }
        }
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(pathsToClean),
    new HtmlWebpackPlugin({
      template: './src/reactNativeComponentTemplate.html',
      inject: 'body',
      filename: './reactQuillViewer-index.html',
      inlineSource: 'viewer.bundle.js',
      chunks: ['viewer']
    }),
    new HtmlWebpackPlugin({
      template: './src/reactNativeComponentTemplate.html',
      inject: 'body',
      filename: './reactQuillEditor-index.html',
      inlineSource: 'editor.bundle.js',
      chunks: ['editor']
    }),

    new HtmlWebpackInlineSourcePlugin()
  ]
}
