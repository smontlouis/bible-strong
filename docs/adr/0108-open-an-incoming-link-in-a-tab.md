# ADR-0108: Open an Incoming link in a Tab

## Status

Accepted. Partially supersedes [ADR-0069](./0069-remove-the-public-shell-from-the-web-workspace.md)
on how the workspace opens a link followed from elsewhere.

## Context

On the web, every resource route opens in the route panel of
[ADR-0041](./0041-keep-web-workspace-navigation-visible.md): a sheet beside the Tab the reader is
studying. That fits a link followed inside the workspace. It does not fit a link that opens the
workspace itself: the button « Open in the app » of the public site, a link shared in a message,
an address typed. The panel then sits beside whatever Tab was last open, or beside nothing for a
guest without Tabs, and closing it loses the passage. A reader asked for the link to open as a
new tab, the way a browser opens a link.

The workspace runs in several browser pages at once. Each page is its own copy of the
application over one `localStorage`, and each wrote its whole list of Tab groups without
reading the others: the last page to write erased the Tabs the others had opened. A link opened
from elsewhere starts such a second page.

## Decision

An **Incoming link** is the address a browser page of the workspace was opened on, when it came
from elsewhere: the navigation timing of the page says `navigate`, not `reload` nor
`back_forward`. When it names a resource a Tab can show, it opens as a Tab:

- Bible passages and chapters in every presentation, Strong entries, dictionary entries, Nave
  topics, commentaries of a chapter or a section, the timeline and its events. The pages of a
  Strong entry other than the entry itself, biblical entities, lists and every other screen keep
  their route and their panel.
- A Tab that already shows exactly the same thing (same version, chapter, verses in focus and
  presentation for a Bible Tab, without parallel versions) is selected instead, in the active
  group first. Otherwise the new Tab joins the active group and is selected.
- The address is then replaced by `/`: the link is consumed. A reload keeps the address it
  finds, and the route panel of a reload stays a panel.
- The route's screen never mounts while this happens, so it neither shows nor corrects its own
  address (a Strong code without its zeros, a book alias).

This applies to the browser only. On iOS and Android a route is a full screen with its own action
to open a Tab, and the desktop app receives its links without loading a page.

The Tab is created at launch, before the tab sync of a signed-in account starts. That sync takes
the groups it finds as already in Firestore and lets the first server snapshot replace them, so
the group that received the Tab is named to the sync, which sends it as a local change.

The pages of the workspace in one browser follow each other's Tabs: when one writes the Tab
groups, the others take the new groups from the storage event and keep what belongs to them
alone, their active Tab in each group, their selected verses, their previews and their active
group. What a page takes from another is not written back. A page keeps its own version of a
group it changed after the version written (a later `updatedAt`): the other page may be writing
an older version, such as a Firestore snapshot that does not yet hold that change, and taking it
would bring back a Tab this page had closed.

## Consequences

- Links from the public site, from messages and from the address bar land on a Tab the reader
  keeps, also in an empty workspace. A guest no longer sees an empty page beside a panel.
- Following a link twice selects the Tab it opened the first time rather than opening another.
- A link to a Strong concordance, a related-words page, a Strong dictionary page or a biblical
  entity still opens in the panel, as no Tab shows these pages.
- Two browser pages of the workspace no longer erase each other's Tabs. Other persisted state
  (settings, the data of a guest) still follows the last page to write.
- Closing the Tab of a link the reader no longer wants is the reader's task, as in a browser.
