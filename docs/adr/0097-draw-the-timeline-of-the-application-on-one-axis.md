# ADR-0097: Draw the timeline of the application on one axis, with the geometry of the site

## Status

Accepted.

## Context

Since October 2026 the public site draws the timeline as a stage: the thirteen periods follow one
another on a single axis, each with its scene, lives and major events are cards with their painting,
the others are pills, and a strip of the periods scrubs through the whole of time. Its geometry
(scales per period, the finer years of the ministry of Jesus, lanes on which no event covers another)
lived in `apps/site/features/timeline/`, and its placement already came from the timeline bundled with
the application (`events.txt`).

The application still drew one period at a time, as rows of text: thirteen screens reached from a
list, changed with arrows, and no way to show an event at its place in time. Readers found the site far
more engaging, and links from an entity's chronology or an event could not lead to the timeline.

Two ways were weighed: show the site's stage in a DOM component, as the map screen does with the
atlas, or draw it natively with the same geometry. The timeline is the most gesture-heavy and
picture-heavy screen of the application: a glide, the back gesture and the scrub of the strip must
feel native, also on modest Android phones, and the stage must work offline once the Timeline
publication is there.

## Decision

Draw the timeline of the application natively, as one stage, from the geometry of the site moved into
`@bible-strong/resource-domain`, as the map's projection was (ADR-0091):

- `@bible-strong/resource-domain/timeline-stage` holds the scales and texts of the periods, the axis,
  the ticks, the placement on lanes, the order of the events and `drawTimelineEvents`, which places
  the events of the publication over the years the bundled timeline gives them (`timelineLayout.json`,
  rebuilt by `yarn workspace @bible-strong/resource-domain timeline:layout`) or over those of their
  dating;
- `@bible-strong/resource-domain/timeline-dates` reads and writes the datings of the publication.

The site and the application draw the same events at the same places; only the room each keeps
before the first year and after the last differs.

In the application, the stage replaces the list of periods and the screen of a period:

- it is drawn from the events of the publication, so it shows the same 625 events as the site, with
  their paintings (ADR-0096); only the events near the view are drawn;
- an event opens in its sheet. While the sheet stays open over the stage (on an iPhone, an
  undimmed sheet), the stage follows the event the sheet shows, as it walks to the event before or
  after, a related event, or a result of the search opened from the stage;
- an event's sheet offers « Situer sur la frise », which opens the stage on it, and the events
  before and after it;
- `/timeline` takes `event` and `period`, and still reads `goTo`, the index of a period in earlier
  links; a timeline tab keeps the year it shows, reads the `sectionIndex` and `eventSlug` of earlier
  tabs, and a tab opened on an event shows the event in its sheet over the stage.

## Consequences

- A change to the geometry changes both surfaces; its tests live in `resource-domain`.
- The application no longer uses `row` nor the per-period scales of `events.txt`; the file still
  names the events for the event screen and the assistant, and feeds `timelineLayout.json`.
- The period details sheet is gone: its summary is on the period's card. « À propos de la chronologie »
  stays in the menu.
- An event the bundled timeline does not know is placed by its dating; one dated only as « Future »
  has no place on the axis and stays reachable from search and links.
- Tabs saved by earlier versions open on their period or event; what they kept of the event itself is
  no longer read.
