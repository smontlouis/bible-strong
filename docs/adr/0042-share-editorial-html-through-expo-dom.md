# ADR-0042: Share editorial HTML through Expo DOM

- Status: Accepted
- Date: 2026-09-07

Dictionary and Nave definitions use the same `HTMLContentDOM` component on Web
and native, hosted by `HTMLViewContent`. The native host explicitly uses
`react-native-webview` (`useExpoDOMWebView: false`), matching the Bible reader,
rather than depending on Expo's default WebView implementation. It uses Expo DOM's
`matchContents` sizing with scrolling owned by the surrounding screen.

The DOM component owns scoped editorial CSS and the bundled Literata font. Theme
colors cross the boundary as serializable values. Delegated link clicks preserve
the existing href, text and class payload through an asynchronous native action.
HTML is cleaned before insertion into the shared Web document; embedded scripts,
event handlers and active embedded documents are not part of editorial content.

This replaces the separate native WebView template and Web native-HTML renderer
for these definitions. Other uses of `StylizedHTMLView`, external video players,
and the Bible and study DOM components keep their existing responsibilities.
