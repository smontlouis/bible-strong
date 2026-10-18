# ADR-0085: Serve app updates from our own server on Cloudflare

## Status

Accepted. Applies from runtime 28.0. Builds of runtime 27.x keep asking EAS Update, where nothing is
published any more.

## Context

EAS Update bills every reader who downloads an update in a month, on top of a monthly plan, and the
bill grows with the number of readers. The application only needs a small part of what it offers:
publish the JavaScript of one runtime for iOS and Android, let readers fetch it, and go back to the
previous update or to the JavaScript of the build when one breaks.

`expo-updates`, the part inside the application, is open source and speaks a public protocol. Any
server that speaks it can replace EAS. Open OTA is such a server, written for Cloudflare: a Worker
answers the checks, D1 keeps the channels, branches and updates, R2 keeps the files, and a dashboard
behind Cloudflare Access handles rollouts and rollbacks. Cloudflare does not bill the bytes R2
sends.

The reader is an Expo DOM component. It finds its page by file name, the MD5 of the page written
into the bundle at export, and `expo-updates` names each file after the key of its asset. An update
keeps the reader working only when every key is the MD5 of its file, every asset carries its
extension, the list comes from `metadata.json` as it is, and the bundle and the pages come from the
same export. Open OTA builds its assets exactly as eas-cli does.

## Decision

- The server is our fork, `smontlouis/open-ota`, deployed with Alchemy from that repository to
  `updates.bible-strong.app`, with its dashboard on `ota.bible-strong.app`. It stays out of this
  monorepo, which keeps one Yarn lockfile.
- The application asks `https://updates.bible-strong.app/manifest` on its build channel, and checks
  every manifest against the certificate in `apps/expo/certs`. The private key lives only in the
  fork's ignored `.keys/` folder, in the Worker's secret, and in the password manager.
- The application checks once per launch, after it has started, downloads an available update in
  the background, and runs it at the next launch. Readers can also check from the settings or from
  the error screen. `checkAutomatically` stays `NEVER`, so the check never delays the launch.
- A rollback to the embedded JavaScript is fetched like an update. `expo-updates` reports it as not
  available, with `isRollBackToEmbedded`, so the three places that check look at both.
- Android builds copy their embedded assets into the updates folder
  (`EX_UPDATES_COPY_EMBEDDED_ASSETS`). After an update the reader's pages are served from that
  folder and load, by relative address, fonts the build embedded; without the copy the reader loses
  its icons.
- `yarn update:staging` and `yarn update:production` export both platforms with Expo, then publish
  that export with the `open-ota` CLI and send the source maps to Sentry. The production workflow
  runs only when started by hand.
- Going back: the dashboard returns each build to the previous update or to its embedded
  JavaScript; `yarn update:rollback-to-embedded:<channel>` does the latter from the command line.

## Consequences

- The cost no longer depends on the number of readers.
- The server, its Alchemy state and its signing key are ours to keep. Losing the key means a new
  build for every reader. The project is young and has one author, but the application only depends
  on the protocol: another server can answer at the same address without a new build.
- The address, the channel and the certificate are native settings. Changing any of them needs a
  new build.
- The npm package of the CLI declares loose versions: the root `resolutions` pin
  `@effect/platform-node-shared` and `.yarnrc.yml` adds the `redis` peer it never uses.
- Publishing must load the environment of its channel, since the manifest carries the public
  configuration the application reads after an update, such as the Resource API address.
- A build ignores an update published before its own JavaScript was bundled, because `expo-updates`
  compares their dates. After a new build, publish again.
- Every reader who launches the application downloads each update once, about 10 MB of compressed
  bundle per platform unless a patch applies.
- On Android, the first launch of a build copies its embedded assets once, which costs storage and
  a little startup time.
- EAS Build receives the certificate through an exception in the root `.easignore`, which otherwise
  drops every `*.pem`.
- The fork deploys with a Cloudflare API token allowed to create tokens: the deployment mints the
  analytics token the dashboard's download counts need.
- PR previews are gone: they published to EAS Update, which builds from runtime 28.0 no longer ask.
