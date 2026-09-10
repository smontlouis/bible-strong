import { resolveWorkspaceLayout } from '../workspaceLayoutPolicy'

const layout = (width: number, panelOpen: boolean, wasDocked = true, sidebarHidden = false) =>
  resolveWorkspaceLayout({ width, panelOpen, wasDocked, sidebarHidden, sidebarWidth: 260 })

it('keeps navigation docked without a panel at widths previously forced into overlay', () => {
  expect(layout(1100, false)).toMatchObject({ sidebarDocked: true, mainWidth: 840 })
  expect(layout(1100, true)).toMatchObject({ sidebarDocked: false })
})

it('preserves 640 pixels for the main content when docking', () => {
  expect(layout(900, false)).toMatchObject({ sidebarDocked: true, mainWidth: 640 })
  expect(layout(899, false).sidebarDocked).toBe(false)
  expect(layout(1400, true)).toMatchObject({ sidebarDocked: true, mainWidth: 640, panelWidth: 500 })
  expect(layout(1399, true).sidebarDocked).toBe(false)
})

it('does not oscillate while resizing around the minimum width', () => {
  let docked = true
  for (const width of [1399, 1401, 1398, 1447]) {
    docked = layout(width, true, docked).sidebarDocked
    expect(docked).toBe(false)
  }
  expect(layout(1448, true, docked).sidebarDocked).toBe(true)
})

it('reclaims space after closing the panel and respects manually hidden navigation', () => {
  expect(layout(1100, false, false).sidebarDocked).toBe(true)
  expect(layout(1440, true, true, true)).toMatchObject({ sidebarDocked: true, mainWidth: 940 })
  expect(layout(1440, true, true, false)).toMatchObject({ mainWidth: 680 })
  expect(layout(1390, true, false, true).sidebarDocked).toBe(false)
})
