# Assistant API boundary

> Superseded by ADR-0059. No local conversation migration is required because this feature had not reached production.

The application calls an independently deployed authenticated HTTPS service. Provider orchestration and server implementation are maintained separately. This repository owns the web interface, local conversation storage, editorial context selection and the public request/event contract in packages/ai-contract. No private server source is required to build the app.
