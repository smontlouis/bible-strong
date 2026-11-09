/**
 * The window's own controls drawn over the page, and the headers that drag the window. Only the
 * desktop app on macOS has either (`windowChrome.desktop.ts`); the Web and the mobile apps draw
 * the page alone.
 */

/** Room the window buttons take at the top left of the page. */
export const useWindowControlsInset = (): number => 0

/** Height of the strip at the sidebar's top that holds the window buttons. */
export const useWindowControlsStripHeight = (): number => 0

/** The marks that let a workspace page header, whose left room is `headerInset`, drag the window. */
export const windowDragRegion = (_headerInset: number): Record<string, string> | undefined =>
  undefined

/** The same for the sidebar's header, under the window buttons. */
export const sidebarDragRegion: Record<string, string> | undefined = undefined

/**
 * Whether the window is translucent behind the shell, which then paints no ground of its own;
 * otherwise the shell keeps its ground.
 */
export const useWindowMaterial = (): boolean => false
