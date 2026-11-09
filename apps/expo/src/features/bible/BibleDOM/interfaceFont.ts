import { PULP_DISPLAY_STACK } from '~helpers/webFontFamily'

// The app's interface face, Pulp Display, for the reader's titles, labels and controls, as
// opposed to the Bible text's font chosen in the reading settings. The web serves it from the
// app's stylesheet; the web view of the native apps loads it with `useInterfaceFontInDOM`.
export const INTERFACE_FONT = PULP_DISPLAY_STACK
