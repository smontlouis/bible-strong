# ADR-0076: Answer a new Worker version from the cache of the one before

## Status

Accepted

## Context

The Resource API Worker keeps its answers in the cache of each Cloudflare data center, under
a key made of the revision of the content an answer reads and of the version of the Worker
that stored it. The Worker version is there on purpose. Before it, a deployment that
corrected how a route answers kept serving what the version before it had stored, for the
thirty days a revisioned answer is kept: the fix was deployed and stayed hidden.

The price is that every deployment starts with an empty cache. The public site renders a
page from about ten reads of the API
([ADR-0068](./0068-serve-indexable-resource-pages-from-the-public-site.md)), and a read the
cache does not answer wakes the HTTP application and the database. The first page the site
rendered after a deployment took 7.6 s, and first renderings stayed at 0.4 to 1.2 s for
minutes, where a page takes 0.2 to 0.4 s once the API has its answers. The Worker was
deployed five times that day. An uncached read also counts against the 1,000 reads a minute
the database allows one address
([ADR-0065](./0065-protect-resources-without-mandatory-attestation.md)), and the site reads
from few addresses: after a deployment every read of every page is uncached.

Nearly every deployment changes no answer: it touches start-up, logs, limits, a new route,
the time a read takes. The cache it discards was right.

## Decision

The Worker version stays in the key. A second copy of each stored answer, the fallback,
answers a deployment that has not read a URL yet.

**Two keys.** A read that is stored is stored twice, at the same moment and for the same
time: under the key of its Worker version, and under a fallback key that carries the content
revision and no Worker version. In its place the fallback key carries the answer revision,
`RESOURCE_API_ANSWER_REVISION`, a constant of the Worker changed by hand.

**A miss looks for the fallback.** A cached answer is read as before, with one lookup. When
the deployed version has stored nothing for a URL, the Worker looks for the fallback. If it
is there, the caller is answered with it at once, marked `x-resource-cache: STALE`, and the
Worker reads the database after the answer, then stores what it read under both keys. If it
is not there, the database is read while the caller waits, as before.

**The answer revision.** A deployment that changes what a cached route answers for the same
content bumps the constant. It then finds no fallback and starts as every deployment did:
cold, and with no answer of an earlier version. A deployment that forgets to bump it serves
answers of the earlier version, as described under Consequences, instead of hiding its own
for thirty days. The routes that already have a response revision of their own keep it: it
is part of the content revision, so of both keys, and bumping it starts that route alone
cold.

**The lifetime of the fallback is that of the answer**: thirty days for a revisioned read,
one hour for a list. Both copies are written together, so the fallback never serves what its
own version would not still have served had no deployment happened. A longer fallback for
lists was not kept: it would have answered every expired list with an old one, which is
another decision than surviving a deployment.

**Lists take part, searches do not.** A page that needs a whole list reads it in a burst of
twenty-six requests or more, the worst first read a deployment causes, and a list is asked
again by the next instance of the site. A search is keyed by what its caller typed and is
seldom asked twice: a second copy of each would be written for little, and reading one again
behind its caller would open the database, and for a semantic search call Workers AI, for an
answer nobody may ask for. Searches already have a revision bumped by hand.

**The refresh counts against the limit that protects the database.** It is a read of the
database caused by one caller, who did not wait for it. Left uncounted, an address could
have the database read 20,000 times a minute after each deployment, the limit of its
requests, where 1,000 is what the database allows it. So the refresh counts against the
1,000 of its caller. Over that limit nothing is read and the fallback stays; the caller is
not refused, since its answer came from the cache and cost the database nothing.

**One refresh at a time for a URL.** Within an isolate, a URL being refreshed is claimed
before anything is awaited: the callers that arrive meanwhile are answered with the fallback
and read nothing. Isolates share only the cache, so a claim is also written there for thirty
seconds. It is not a lock: two isolates that look in the same few milliseconds both read.
A refresh that stored nothing (refused, failed, not a 200) leaves its claim, and is not
tried again in that data center for those thirty seconds. The claim is made in the name of
the Worker version, so a deployment that follows another at once is not held back by it.
Reads that miss together with no fallback each read the database, as they did.

**Only a 200 is stored**, by a refresh as by any read. A failed refresh leaves both keys as
they were.

**A STALE answer is always sent whole.** A caller whose `If-None-Match` matches the fallback
gets the body with status 200 and the mark, not 304: 304 says, in the name of the deployed
version, that what the caller holds is what it would answer, and the deployed version has not
read the URL. The refresh asks the database without the validator of its caller, which would
be answered 304 and stored nowhere. An answer of the deployed version says 304 as before.

**The site keeps a page rendered with a STALE answer for a minute**, like a page missing a
part, and marks it `X-Page-Stale: 1`; it is not called incomplete. The read of the API marks
the response being built, and what decides the headers of a page, of a preview or of a
sitemap reads the mark there, so no loader passes it on. What a server instance keeps for an
hour it keeps only from current answers: a read a STALE answer came into is not kept, and
the pages that were waiting for the same read ask again for themselves.

Dropping the Worker version from the key, with the answer revision alone, would be what the
service did before with a constant added: one forgotten bump hides a fix for thirty days,
and nothing tells that it happened. The warm-up run of the site does not replace the
fallback either: a run over its pages takes hours to days, longer than the time between two
deployments of a day.

## Consequences

A deployment that changes no answer, nearly all of them, no longer makes first reads slow.
In a local run of the Worker over a cache an earlier version had filled, with a read of the
database made to take 400 ms, the first read of a URL by the new version was answered in
6 ms where it took 410 ms, ten callers arriving together were all answered at once for one
read of the database, and the second read was a `HIT` of the new version.

After a deployment the site is no longer limited to the pages 1,000 uncached reads a minute
allow: its reads are answered from the fallback, and what is over the limit is refreshed
later, by a later read.

**A wrong answer can still be served**, in one case: a deployment changes what a route
answers and the answer revision is not bumped. Then:

- For each URL, in each data center, whoever reads it first after the deployment is given
  the answer of the earlier version, and so are the callers that arrive during the refresh,
  a few hundred milliseconds. The answer is marked `STALE`. The next read is answered by the
  deployed version.
- A refresh that stores nothing prolongs this by thirty seconds each time, and a URL only
  read by a caller over the database limit stays on the fallback until another caller reads
  it. While the database cannot be read, the fallback is what is served.
- A URL nobody reads keeps its fallback until someone does: thirty days at most, one hour
  for a list. The answer served may therefore come from a version several deployments old,
  as long as none of them bumped the revision.
- A reader of the site sees a page rendered with such an answer for one minute, the time the
  CDN keeps it, and the page rendered next is right.
- The applications do not read the mark. An application keeps an Online answer for as long
  as it keeps anything, a session for a chapter, so the reader who was given the old answer
  keeps it that long. A browser cannot read the mark at all: `x-resource-cache` is not among
  the headers the API exposes to other origins. The study assistant reads the API from
  another repository, and what it does with the mark was not checked.

Before this decision the same mistake could not happen, at the price of the cold start. With
the key that had no Worker version it lasted thirty days for everyone.

A correct answer can be marked `STALE` too: that is the usual case, and it costs the site
one more rendering of the page a minute later.

Every stored read is written twice. Cloudflare may evict a copy that is written and not
read, and the fallback is read only after a deployment: it is there most of the time, not
always, and a URL without it is read as before.

During the minutes that follow a deployment, each page of the site whose reads include a
URL not yet refreshed is rendered twice, a minute apart. This goes on, more and more rarely,
for as long as URLs are read for the first time since the deployment.

The warm-up run of the site (`apps/site/scripts`) tells an incomplete page by its being
rendered again 75 seconds later. A page marked `X-Page-Stale` is rendered again too and is
not in trouble: the run has to learn the header before it is used after a deployment of the
Worker that carries the fallback.

The first deployment of the Worker with the fallback finds none and starts cold. The site
can be deployed before or after it: against a Worker that never answers `STALE` it behaves
as it did.

The ETag of an answer names its content revision, not the Worker version. A caller that
revalidates an answer of an earlier version is told 304 by the deployed one, whatever the
cache does. No client of the API sends a validator today.
