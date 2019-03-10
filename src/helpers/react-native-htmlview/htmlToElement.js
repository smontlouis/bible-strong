const React = require('react')
const ReactNative = require('react-native')
const htmlparser = require('./vendor/htmlparser2')
const entities = require('./vendor/entities')

const {
  Text
} = ReactNative

const LINE_BREAK = '\n'
const PARAGRAPH_BREAK = '\n'
const BULLET = '\n\u2022 '

function htmlToElement (rawHtml, opts, done) {
  function domToElement (dom, parent) {
    if (!dom) return null

    return dom.map((node, index, list) => {
      if (opts.customRenderer) {
        const rendered = opts.customRenderer(node, index, list)
        if (rendered || rendered === null) return rendered
      }

      if (node.type === 'text') {
        return (
          <Text key={index} style={parent ? opts.styles[parent.name] : opts.styles.p}>
            {entities.decodeHTML(node.data)}
          </Text>
        )
      }

      if (node.type === 'tag') {
        let linkPressHandler = null
        if (node.name === 'a' && node.attribs && node.attribs.href) {
          linkPressHandler = () => opts.linkHandler(
            entities.decodeHTML(node.attribs.href),
            entities.decodeHTML(node.children[0].data)
          )
        }

        return (
          <Text key={index} onPress={linkPressHandler}>
            {node.name === 'pre' ? LINE_BREAK : null}
            {node.name === 'li' ? BULLET : null}
            {domToElement(node.children, node)}
            {node.name === 'br' ? LINE_BREAK : null}
            {node.name === 'p' && index < list.length - 1 ? PARAGRAPH_BREAK : null}
            {node.name === 'h1' || node.name === 'h2' || node.name === 'h3' || node.name === 'h4' || node.name === 'h5' ? PARAGRAPH_BREAK : null}
          </Text>
        )
      }

      return null
    })
  }

  const handler = new htmlparser.DomHandler((err, dom) => {
    if (err) done(err)
    done(null, domToElement(dom))
  })
  const parser = new htmlparser.Parser(handler)
  parser.write(rawHtml)
  parser.done()
}

module.exports = htmlToElement
