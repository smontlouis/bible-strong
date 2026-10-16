# ADR-0085: Give AI assistants the study resources through an MCP server

## Status

Accepted. Built in October 2026; not yet deployed nor submitted.

## Context

People ask assistants such as ChatGPT about the Bible, and the assistant answers from memory:
a verse quoted nearly right, a Strong number that does not exist, a commentary nobody wrote.
Bible Strong publishes exactly what those answers lack, and a reader who meets it there may
never have heard of the app.

OpenAI publishes plugins in a directory shared by ChatGPT and Codex. A plugin is a package
(a listing, skills) connected to an MCP server the publisher hosts; the server may return UI
that the assistant frames in the conversation, under the open MCP Apps standard. The same
server serves any other assistant that speaks MCP.

Everything the plugin gives is already public: the Resource API serves it to the site and to
the application. The study assistant of the application is another matter (ADR-0048,
ADR-0051): it holds prompts and a provider, and lives in a private repository.

## Decision

The plugin lives in this repository, in `packages/mcp-service`: an MCP server deployed as its
own Worker, `bible-strong-mcp`, at `mcp.bible-strong.app`. It reads the Resource API through a
binding, as the site does, keeps nothing and asks for no account.

- **Every tool only reads.** The server has no sign-in, no write and no state. A request
  carries what it reads and nothing of the conversation.
- **Text comes from the resources, never from the model.** A tool takes a reference, a Strong
  number or a name, and the server reads the text. A card is handed its content by the
  server, beside the result and out of what the model reads; nothing the model writes is
  drawn as Scripture.
- **A capability is offered twice when it has a card.** `read_passage` answers the model
  alone; `show_passage` answers the same and shows the card. The model gathers what it needs
  without filling the conversation with cards. Left to choose, it reads and shows nothing:
  the instructions of the server therefore ask for one card an answer, the one of what the
  question is about, and for the rest to be read without showing. Both run the same reading.
- **One document draws every card.** It is written against MCP Apps (JSON-RPC over
  `postMessage`), with its script and styles inside, and uses nothing only one host has. A
  card asks the network for nothing but the pictures of the timeline.
- **A card follows the host, not the site.** The host owns the ground, the text colours and
  the type; Bible Strong brings its blues, its highlight and the colour of the words of
  Jesus from `design-system/project/tokens.json`. The families of the site are not used:
  the guidelines of the directory forbid custom fonts.
- **A card opens what it points to in the whole screen**, where it can come back; in the flow
  of a conversation it asks for it as a turn of the conversation instead. A card in the flow
  never scrolls and never holds a second view.
- **The Resource API counts the caller of the server**, whose address the server gives it, as
  the site gives the address of its reader.
- **Every result links to its page on the site.**

The names of books and versions, the reading of verse layout, of topic outlines and of
commentary markup, and the paths of the site are written again in the package, from
`apps/site/features`. The site is an application, not a package, and moving them was not the
subject. Tests hold the versions to the catalog; the rest is held by reading.

## Consequences

- An answer about the Bible in ChatGPT can rest on the text, with a link to Bible Strong
  under it. The same server can be given to other assistants without change.
- The address of the server, the names of the tools and their inputs become a published
  contract: OpenAI scans the server each day and holds a change until it passes. A card kept
  by a host is addressed by a version, raised when the document would break a kept copy.
- All of ChatGPT reaches the Resource API from a few addresses of OpenAI, and shares their
  allowance: 300 searches and 60 searches by meaning a minute for each address. Past it, a
  tool says to try again. If the plugin is used widely, the server will need an allowance of
  its own.
- What the site and the plugin both read is written twice. A change to how a verse is laid
  out, or to a path of the site, is made in both, until a shared package holds it.
- The plugin shows the commentaries of several traditions side by side and names their
  authors. It does not choose between them, and its instructions tell the model not to.
- The review of the directory asks for a privacy policy that covers the server, a support
  page, five cases to pass, three to refuse and a recorded walkthrough. The first two are
  pages of the site; the package carries the cases.
