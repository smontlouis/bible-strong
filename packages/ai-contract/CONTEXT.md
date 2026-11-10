# Study assistant API contract

**Study request** — Public input to the separately hosted assistant API.

**Study event** — Public streaming event for text, resource activity and completion.

**Quota** — What an account may still ask the assistant today: unlimited, a number of questions until a reset time, or none until the account's address is verified. The service counts and decides it; a client only shows it, and receives it in the stream only when it declares the quota capability.

**Follow-up question** — A question the reader may ask next, suggested after a finished answer. Sent only to clients that declare the follow-up capability; the client offers it to the reader and sends nothing on its own.

**Application language** — The interface language used as the assistant's default response language, independent of the Bible edition being studied.

**Default reading Bible** — The configured edition for new Bible readings and text searches without an explicit edition.

**Default Strong Bible** — The configured indexed edition for concordance or a separately attributed alternative when the open edition has no published word alignment.

**Open reading version** — The edition of the passage attached to a Study request, independently of both defaults.

**Public tab action** — An explicit request to navigate to public editorial content in a new application tab, excluding user-owned items and participation changes.
