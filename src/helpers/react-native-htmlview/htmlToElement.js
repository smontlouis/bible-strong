import Text from '~common/ui/Text'

const React = require('react')
const htmlparser = require('./vendor/htmlparser2')
const entities = require('./vendor/entities')

const LINE_BREAK = '\n'
const PARAGRAPH_BREAK = '\n'
const BULLET = '\n'

// Pattern to match Strong's references like H7311, G1234
// Captures: group 1 = H or G, group 2 = the number
const STRONG_REF_PATTERN = /\b([HG])(\d+)\b/g

function htmlToElement(rawHtml, opts, done) {
  function domToElement(dom, parent) {
    if (!dom) return null

    return dom.map((node, index, list) => {
      if (opts.customRenderer) {
        const rendered = opts.customRenderer(node, index, list, parent, domToElement)
        if (rendered || rendered === null) return rendered
      }

      if (node.type === 'text') {
        const text = entities.decodeHTML(node.data)
        const style = parent ? opts.styles[parent.name] : opts.styles.p

        // Check if text contains Strong's references and we have a link handler
        if (opts.linkHandler && STRONG_REF_PATTERN.test(text)) {
          // Reset regex state
          STRONG_REF_PATTERN.lastIndex = 0

          const parts = []
          let lastIndex = 0
          let match

          while ((match = STRONG_REF_PATTERN.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
              parts.push(
                <Text selectable key={`${index}-text-${lastIndex}`} style={style}>
                  {text.substring(lastIndex, match.index)}
                </Text>
              )
            }

            // Extract prefix (H/G) and number
            const prefix = match[1] // 'H' or 'G'
            const numberPart = match[2] // e.g., '7311'
            const fullRef = prefix + numberPart // e.g., 'H7311'
            // Use book 1 for Hebrew (H), book 40 for Greek (G)
            const book = prefix === 'H' ? 1 : 40

            parts.push(
              <Text
                selectable
                key={`${index}-link-${match.index}`}
                style={opts.styles.a || style}
                onPress={() => opts.linkHandler(numberPart, book)}
              >
                {fullRef}
              </Text>
            )

            lastIndex = match.index + match[0].length
          }

          // Add remaining text after last match
          if (lastIndex < text.length) {
            parts.push(
              <Text selectable key={`${index}-text-${lastIndex}`} style={style}>
                {text.substring(lastIndex)}
              </Text>
            )
          }

          return <Text selectable key={index}>{parts}</Text>
        }

        return (
          <Text selectable key={index} style={style}>
            {text}
          </Text>
        )
      }

      if (node.type === 'tag') {
        let linkPressHandler = null
        if (node.name === 'a' && node.attribs && node.attribs.href) {
          linkPressHandler = () =>
            opts.linkHandler(
              entities.decodeHTML(node.attribs.href),
              entities.decodeHTML(node.children[0].data),
              entities.decodeHTML(node.attribs.class)
            )
        }

        return (
          <Text selectable key={index} onPress={linkPressHandler}>
            {node.name === 'pre' ? LINE_BREAK : null}
            {node.name === 'li' ? BULLET : null}
            {domToElement(node.children, node)}
            {node.name === 'br' ? LINE_BREAK : null}
            {node.name === 'p' && index < list.length - 1 ? PARAGRAPH_BREAK : null}
            {node.name === 'h1' ||
            node.name === 'h2' ||
            node.name === 'h3' ||
            node.name === 'h4' ||
            node.name === 'h5'
              ? PARAGRAPH_BREAK
              : null}
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
