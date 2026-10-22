# ADR-0084: Keep rendered pages for a month, in the cache Cloudflare puts in front of the Worker

## Status

Accepted. Replaces the page cache of [ADR-0083](./0083-run-the-public-site-as-a-cloudflare-worker.md).

## Context

The Worker kept its own pages, with the Cache API: in the data centre that rendered them, for a
day, never served stale, and under a key that carried the deployment. Every merge to `master`
deployed the site, whatever it changed, and so emptied the cache. The content of a page only
changes when its resource is republished, and the Resource API keeps its own answers for thirty
days.

A missed page costs little computing on Cloudflare. What a better cache buys is the time a reader
and a crawler wait, and the reads the database is spared.

Cloudflare has a cache of its own in front of a Worker entrypoint (Workers Cache): shared by every
data centre, honouring `stale-while-revalidate`, answering without running the Worker, purged by
tag from the Worker itself, and able to keep its entries across deployments.

## Decision

- **Fewer deployments.** Cloudflare builds the site only when `apps/site`, the packages it uses
  or the design tokens change, and installs only the site workspace.
- **The cache in front of the Worker.** A gateway entrypoint receives every request and is not
  kept. It hands a read to the `Pages` entrypoint, whose answers Cloudflare keeps. An answer
  whose route says nothing about its keeping is marked `private`: Cloudflare would otherwise keep
  it two hours.
- **A month.** A whole page says `s-maxage=2592000, stale-while-revalidate=604800`. A page missing
  a part, or rendered from a stale answer of the API, is still kept a minute.
- **A key named after the build.** The gateway names the key: the revision of the build, then the
  address without the parameters sharers add to a link. The revision is a digest of every module
  of the Worker, among them the list of the files the browser is sent. A deployment of the same
  build keeps every page; a deployment of another build starts anew, without a purge.
- **A request to render again.** A kept page carries a tag for each of the first three folders
  of its address. `POST /__cache/refresh`, behind a secret, purges every page or the pages under
  some folders; `yarn site:pages:refresh` calls it. The deployment of the Resource API no longer
  ends with it (amendment below).

Keeping the pages of a family (`/bible`, `/strong`…) across a deployment that changes another
family was considered and left out. A kept page names the scripts and styles of its build, which
the next build removes: they would have to be archived. And a reader moving from a page of an
older build to a page of the new one would run the older scripts against the newer server. The
build computes one revision for the whole site instead.

## Consequences

- A page rendered once is kept for every reader, wherever they are, for a month, and its first
  reader after that month is not made to wait.
- A republished resource shows on a page already kept only once its pages are asked to be
  rendered again. Forgetting it leaves the older text for up to five weeks.
- A deployment that changes the site still empties the cache of every page, not only of the
  pages it changes.
- Every request still runs the gateway, which only computes a key.
- The same page reached with another order of its parameters is kept twice.
- The warm-up script reads `Cf-Cache-Status`; a page it renders is kept for every data centre.
- The feature is recent: its limits (the size of an answer, the rate of purges) are those of
  Cloudflare's free plan whatever the plan of the account.

## Amendment (2026-10-15): pages are refreshed by hand, and a publication keeps them

Two things emptied the whole page cache although no page had changed:

- `yarn resources:worker:deploy` ended with `yarn site:pages:refresh --everything`. It no longer
  does: the Resource API keeps its own answers across a deployment too (ADR-0076, amended), and the
  operator refreshes the folders a change made stale, with `yarn cache:invalidate --site <folder>`.
- The build bundled the whole Artifact catalog, through `BHG_INTERLINEAR_IDENTITY`, so that every
  publication gave the next automatic deployment of the site a new revision. The identity now has
  a module of its own (`@bible-strong/resource-catalog/interlinear-bible-identity`), and the
  build-revision plugin fails a build that bundles `mobile-resource-catalog.json`.

A republished resource therefore keeps its pages until its folders are refreshed, or for the month
a page is kept. A deployment that changes the code of the site still renders every page again: a
page names the scripts and styles of its build.

## Amendment (2026-10-22): moves and missing pages are kept, and parameters no page reads are sent away

Crawlers rendered pages the cache could not keep, each one a read of the Resource API:

- **Permanent moves.** A route that sends an address to its canonical spelling, a Strong code to
  the sense that answers it, or a commentary section to its chapter decides from the address and
  the published resources only, often after reading them. Such a move is now kept like a page,
  under the same tags, so that `yarn site:pages:refresh` finds it again.
- **Missing pages.** A page that does not exist is kept an hour.
- **Failures** are still not kept. While a page kept before is served stale, Cloudflare keeps it
  and renders it again; a failure it kept would take its place.
- A server function, and the page of a study, which its author publishes or withdraws at any
  time, are still kept by no one.
- **Parameters no page reads.** Any query string made another kept copy of a page, rendered anew.
  The gateway now sends a read with a parameter its page does not read to the same address
  without it, with a permanent move it answers itself (`features/resources/pageParameters.ts`).
  The parameters a sharer adds to a link stay where they are. The commentaries of a Bible page
  are written in their one spelling, without the ones the catalog does not know. A parameter a
  page comes to read must be named there, or the page never sees it. Server functions and share
  images are left alone.

`robots.txt` also turns crawlers away from the server functions and from the Bible pages with
commentaries in their text, which are not indexed.
