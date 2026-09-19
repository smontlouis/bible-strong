# Development-only assistant diagnostics

The web AI dialog exposes an optional Debug panel only when `__DEV__` is true. Its client and renderer are conditionally required so the production web bundle contains neither the diagnostic transport nor its UI implementation. No private provider prompts or credentials are checked into this public repository.

Diagnostics come from the real authenticated Cloudflare request, not from a local replica or a replay. The private service grants access through a separate UID allowlist, dev-origin allowlist, feature switch and signed 15-minute session using the existing Firebase sign-in. Hiding the button is not the authorization boundary. The existing public chat/event contract remains unchanged; a dedicated diagnostic route adds events consumed only by the development client.

Sessions and traces stay in component memory and are separate from conversation persistence. Turning Debug off clears both; changing conversations clears the displayed trace; expiry, account changes and reload discard access. Copying JSON is an explicit user action and can copy private prompts and conversation content. No additional password or provider confirmation is requested.

The backend security implementation, deployment settings and tests live in `bible-strong-ai`. The local browser uses the same configured API base URL as ordinary chat. Production web export was inspected to verify removal of diagnostic endpoint strings and transport code.
