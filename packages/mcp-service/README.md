# Assistant plugin

The Bible Strong plugin for AI assistants (ADR-0085): an MCP server at
`https://mcp.bible-strong.app/mcp`, the cards it shows inside a conversation, and the package
submitted to the directory of plugins shared by ChatGPT and Codex.

The server reads the Resource API through a binding (`RESOURCE_API`), and at its public
address when it has none. It keeps nothing and asks for no account: every tool only reads.

```text
src/
  worker.ts            what the Worker answers: /mcp, the ownership token, the workbench
  server.ts            the MCP server: one read tool per capability, one show tool per card
  tools.ts             the capabilities, with the name and the description of each tool
  capabilities/        one reading each: what it asks the Resource API and what it answers
  cards/types.ts       what a card is handed to draw
  bible/, strong/      references, versions, verse layout, Strong numbers
  richText.ts          editorial HTML read into the blocks a card draws
  links.ts             the page of bible-strong.app each result opens
widgets/
  src/                 the card: one document for every kind, written against MCP Apps
  workbench/           the page that shows a card outside a host
plugin/                the package: plugin.json, mcp.json, skills/, assets/
```

## Run it

```bash
yarn dev:mcp
```

builds the card and starts the server on `http://localhost:8798`, asking the deployed Resource
API (Wrangler must be signed in to Cloudflare). While it runs, `yarn workspace
@bible-strong/mcp-service widgets:watch` rebuilds the card on each change.

## Look at the cards

`http://localhost:8798/workbench` frames each card as a host does, with real results. Choose a
tool and an example, change the theme, the width and whether the host offers the whole screen;
the panel shows what the model reads and every message the card sends.

- `/workbench#show_strong_entry/1` opens one tool on one of its examples.
- `/workbench?bare#show_passage` leaves the card alone at the width of the window;
  `&theme=dark`, `&locale=en-US` and `&fullscreen=no` set what the panel would.

Examples live in `widgets/workbench/presets.ts`: add the case that strains a card when you
find one.

## Ask the tools

```bash
npx @modelcontextprotocol/inspector@latest
```

then choose **Streamable HTTP** and `http://localhost:8798/mcp`. Each capability is offered
twice when it has a card: `read_passage` answers the model alone, `show_passage` answers the
same and shows the card. The instructions of the server ask the model for one card an answer.

The terminal of the development server names what a host asks for, one line a request:
`→ tools/call show_passage {"reference":"Jean 3:16"}`.

## Try it in ChatGPT

ChatGPT needs a public HTTPS address. Open a tunnel to the local server, or deploy:

```bash
cloudflared tunnel --url http://localhost:8798
```

At <https://chatgpt.com/plugins>, choose **Add custom MCP server**, give the address ending in
`/mcp`, no authentication, then **Create as a plugin**. Type `@` in a new conversation to
choose it. After a change to a tool or to the card, choose **Refresh** on the connection.

To try the whole package with its skills in the ChatGPT desktop app, this repository is a
marketplace of one plugin (`.agents/plugins/marketplace.json`): restart the app and install
Bible Strong from that source.

## Check it

```bash
yarn workspace @bible-strong/mcp-service typecheck
yarn workspace @bible-strong/mcp-service test
```

The tests ask the server as a host does, with a Resource API that answers from a table. They
also hold the package to the limits of the submission portal, and every tool a skill or a
card names to one that exists.

## Deploy and submit

```bash
yarn mcp:worker:deploy     # by hand, from an up-to-date master
yarn mcp:plugin:pack       # dist/bible-strong-<version>.zip, for the submission portal
```

- **The address cannot change.** `mcp.bible-strong.app` is part of the published plugin; a
  server at another address is another plugin.
- **A tool is a published contract.** A change to a name or to an input is scanned by OpenAI
  each day and held until it passes; keep the inputs of published tools working.
- **A card is kept by its address.** When the document changes in a way a kept copy would
  break, raise the version in `cardUri` (`src/server.ts`).
- **Ownership.** The portal gives a token to publish at
  `/.well-known/openai-apps-challenge`: set `OPENAI_APPS_CHALLENGE` in `wrangler.jsonc` and
  deploy.
- **The package** (listing, skills, review cases) changes with a new version in
  `plugin/plugin.json` and a new upload. The review also asks for a recorded walkthrough,
  entered in the portal or as `review.demo_recording_url`.
- **The zone must let assistants in.** A rule of the Cloudflare zone that turns AI bots away
  would turn away the scan of the portal and the calls of ChatGPT: it must leave
  `mcp.bible-strong.app` out. The scan failing to connect is the sign of it.
