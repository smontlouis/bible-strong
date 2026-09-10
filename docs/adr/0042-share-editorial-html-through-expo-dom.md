# ADR-0042: Share editorial HTML through Expo DOM

- Status: Accepted
- Date: 2026-09-07

Dictionary and Nave definitions use the same `HTMLContentDOM` component on Web
and native, hosted by `HTMLViewContent`. The native host explicitly uses
`react-native-webview` (`useExpoDOMWebView: false`), matching the Bible reader,
rather than depending on Expo's default WebView implementation. It starts with an explicit
200-point native height. The DOM content root reports its measured height through
an asynchronous native action after rendering and whenever its size changes.
The host applies that height to its non-flexing WebView container; scrolling
remains owned by the surrounding screen. It does not use `matchContents`.

The DOM component owns scoped editorial CSS and the bundled Literata font. Theme
colors cross the boundary as serializable values. Delegated link clicks preserve
the existing href, text and class payload through an asynchronous native action.
HTML is cleaned before insertion into the shared Web document; embedded scripts,
event handlers and active embedded documents are not part of editorial content.

This replaces the separate native WebView template and Web native-HTML renderer
for these definitions. Other uses of `StylizedHTMLView`, external video players,
and the Bible and study DOM components keep their existing responsibilities.

## Reading renderer selection (2026-09-09)

Commentary sections, dictionary and Nave details, and full lexicon editorial HTML
use `SwitchableHTMLView`. Web always renders DOM directly, including when the
an explicit prop requests native rendering. On mobile, its
`engine` prop can force `native` or `dom`; otherwise it defaults to native rendering. This is a code-only choice; Bible Params does not expose a renderer setting. Switching engines does not change
the route, resource identity, or current tab.

Both implementations share `readingHtml.ts` for sanitizing and editorial tag
styles. Their typography follows `user.fontFamily`, `fontSizeScale`, and
`lineHeight` with the ordinary Bible reader's 19/32 base sizing. Link text and
underlines use the primary color; emphasis follows the former DOM appearance.
Native renders with `@native-html/render`; DOM retains explicit measured height.
The legacy `StylizedHTMLView` remains available to other consumers with custom
HTML styles. The former Nave HTML host delegates to this common reader. All these readers
receive the same Bible typography.

### Forcing a renderer on mobile

```tsx
import SwitchableHTMLView from '~common/SwitchableHTMLView'

<SwitchableHTMLView value={html} engine="native" onLinkPress={openLink} />
<SwitchableHTMLView value={html} engine="dom" onLinkPress={openLink} />
```

Omit `engine` to use native rendering on mobile. Web ignores
the override and always uses direct DOM. Use `padded` for
standalone dictionary-style content; omit it inside cards that already provide
padding. `onLinkClicked` preserves `{ href, content, type }` for dictionary
navigation. The DOM reader loads the same bundled Literata OTF as the Bible.
The native reader enables adjacent paragraph margin collapsing to mirror CSS.

## Bible reference previews (2026-09-10)

On Web, editorial Bible links open a shared preview through the application host before navigation. Native platforms retain their original direct navigation and form sheets. The preview uses ContextualSheet (anchored popover on Web only), loads the requested passage through Resource access and provides the
original link action in its header. The HTML document continues to emit the same
serializable href/text/class payload. Dictionary, Strong and Nave links also use the preview, carrying their resource source context; ordinary external links retain their handlers. Concordance verse clicks remain direct navigation.
See `apps/expo/src/features/bibleReferencePreview/README.md` for target formats,
version selection and the additional native-text entry points.
