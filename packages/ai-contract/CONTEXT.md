# Study assistant API contract

**Study request** — Public input to the separately hosted assistant API.

**Study event** — Public streaming event for text, resource activity and completion.

**Study step** — Where the assistant is in answering, sent as the message of a status event: reading the question, searching the library, thinking, reading, going over what it read, preparing the answer. A client shows a message it does not know as resources being read.

**Tool activity summary** — What a read found, for the reader: how many texts, the titles of what was read; never the traditions of a search. Optional and display-only: a malformed one is left out.

**Quota** — What an account may still ask the assistant today: unlimited, a number of questions until a reset time, none until the account's address is verified, or none while the service has paused the questions of accounts without Premium. The service counts and decides it; a client only shows it, and receives it in the stream only when it declares the quota capability.

**Follow-up question** — A question the reader may ask next, suggested after a finished answer. Sent only to clients that declare the follow-up capability; the client offers it to the reader and sends nothing on its own.

**Application language** — The interface language used as the assistant's default response language, independent of the Bible edition being studied.

**Default reading Bible** — The configured edition for new Bible readings and text searches without an explicit edition.

**Default Strong Bible** — The configured indexed edition for concordance or a separately attributed alternative when the open edition has no published word alignment.

**Open reading version** — The edition of the passage attached to a Study request, independently of both defaults.

**Public tab action** — An explicit request to navigate to public editorial content in a new application tab, excluding user-owned items and participation changes.
