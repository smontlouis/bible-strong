# ADR-0110: Sell one Premium plan through each surface's own channel

## Status

Accepted.

## Context

Bible Strong is about to sell a subscription, Premium, whose main benefit is the study assistant
without a daily limit. The assistant runs on the server. The same study workspace runs on iOS,
Android, the Web and the desktop app, and one account signs in on all of them. Prices, the free
allowance and their economics are decided outside this repository.

- **Apple** requires in-app purchase for a digital subscription sold in an iOS app or in a Mac App
  Store app (guideline 3.1.1). An app may honour a subscription bought elsewhere only if it also
  sells it in-app (3.1.3(b)), and outside the United States it may not point readers to a web
  checkout. Google Play requires Play Billing in the same way.
- **Links out of the store apps save nothing.** In the European Union since 1 October 2026, a
  sale through a link from the app to a web checkout still owes Apple a 10 % commission, under a
  12-month commitment and a parental gate. With the payment fees on top, that is about what
  in-app purchase costs. Google's external-offer programmes also keep a commission. In the United
  States the commission-free link is contested in court.
- **On the Web and in the installer builds no store applies**, but the seller owes VAT in every
  customer's country: through the EU One-Stop Shop beyond 10 000 € of cross-border sales, from
  the first sale in the United Kingdom, and under their own rules in Switzerland, Canada and
  several African countries.
- **109 readers (November 2026) still pay App Store and Google Play subscriptions** sold before
  in-app purchases left the app in 2024: `com.smontlouis.biblestrong.onemonth.min`, `.onemonth`
  and `.onemonth.max`. IAPHUB reports their renewals to `iaphub` (`apps/api`), which writes
  `subscription` on the user document. Today that field only shows a badge.
- **Readers also give**, through Stripe on the public site's give page (one-off and monthly
  gifts), through Tipeee and through PayPal.

## Decision

**One plan, held by the account.**
- Premium is a single entitlement, `premium`, in RevenueCat.
- The RevenueCat customer is the Firebase uid of a signed-in, non-anonymous account. The
  workspace calls `logIn(uid)` when an account session starts and `logOut` when it ends.
- Every surface asks for such an account before a purchase; a Guest session signs in first.
  Premium unlocks a server-side service and follows the reader from one surface to another, the
  case in which App Review allows a purchase to require an account.

**Each surface sells through its own channel.**

| Surface | Sales channel | Client |
| --- | --- | --- |
| iOS and iPadOS app, and the iPad app on Apple Silicon Macs | App Store in-app purchase | `react-native-purchases` |
| Android app | Google Play Billing | `react-native-purchases` |
| Web workspace | Web checkout run by Stripe | `react-native-purchases`, web build |
| Installer builds | The same web checkout, opened in the reader's browser | RevenueCat purchase link carrying the uid; the app reads the customer info again when its window regains focus |
| Mac App Store build | App Store in-app purchase (StoreKit) | A Tauri plugin over RevenueCat's Swift SDK |
| Public site | The same web checkout, after sign-in | RevenueCat purchase link |

- **The installer builds hand the checkout to the browser**, as they do for Browser sign-in
  (ADR-0107). There the reader has their wallets and saved cards, and the hosted checkout returns
  to a real web origin instead of `tauri://localhost`.
- **The App Store products are shared** by the iOS app and the Mac App Store build, which have
  the same bundle identifier and App Store Connect record.
- **The new products join the subscription group of the old ones.** An Apple ID then holds only
  one of them at a time, and an old subscriber can switch from the system settings.

**No path from a store app to the web checkout.** The iOS and Android apps and the Mac App Store
build never show a web price, a link to the checkout, or a mention that it exists.
- The offer knows which sales channel it runs on.
- The Mac App Store build learns its channel from a `distribution` field of the bootstrap state,
  not from the absence of the updater.

**Stripe is the merchant of record on the Web.** The web checkout uses RevenueCat's Stripe
Billing integration with Stripe Managed Payments, on the Stripe account that already takes gifts.
- Stripe collects and remits VAT and sales taxes, and handles disputes, refunds and the right of
  withdrawal.
- Every Premium product carries the tax code of an AI service for personal use
  (`txcd_10105001`). A product without an eligible code would make Stripe fall back to its
  standard checkout and leave Bible Strong as the seller, liable for the tax.
- Gifts carry no eligible code and stay on Stripe's standard payments.
- If Stripe declines the account, Paddle takes its place: it is also a merchant of record and has
  a RevenueCat integration.

**RevenueCat is the only record of Premium.**
- Clients read it from the SDK's customer info, to show the badge and to hide the offer from a
  reader who already holds Premium.
- The assistant service checks Premium with RevenueCat for the uid of each request; it never
  trusts what a client says.
- Nothing copies Premium into Firestore or into a Firebase custom claim. A claim reaches the
  client only when its ID token refreshes, so a reader could pay and still be refused for up to
  an hour.

**The offer belongs to the app.**
- It is drawn with the surface grammar (ADR-0086).
- RevenueCat Offerings choose the products it shows, so they change without a release.
- It shows where an existing subscription is managed (App Store, Google Play or Stripe, through
  the customer info's management link), a restore button on Apple platforms, and the terms and
  privacy links App Review requires.

**Former sponsorships become Premium.** The three old products are attached to `premium`:
1. Their App Store and Google Play transactions are imported into RevenueCat under the uid
   IAPHUB already holds.
2. App Store Server Notifications and Google Play's real-time notifications move to RevenueCat.
3. `iaphub` and the `subscription` field of the user document are then removed.

The old products keep renewing at their price, and nothing offers them any more.

**Donors receive Premium as a RevenueCat promotional entitlement**, granted for a fixed period
through RevenueCat's API. Every surface and the assistant then see it as they see a
subscription. Who counts as a donor is decided apart from this ADR.

**Premium ships with a store build.** `react-native-purchases` is a native module, so the iOS and
Android binaries that sell Premium carry a new runtime version; an OTA update cannot reach them.
- Sales open on the stores, the Web, the installer builds and the Mac App Store build together.
  Until then, no surface mentions Premium.
- If the StoreKit plugin is not ready when sales open, the Mac App Store build goes on showing
  nothing of Premium.

## Considered options

- **Keeping IAPHUB.** It serves both stores but sells nothing on the Web, and its client left the
  app in 2024.
- **Stripe alone, without RevenueCat.** Stripe cannot sell inside the store apps. The app would
  need two purchase systems and its own reconciliation between them.
- **RevenueCat Billing, with Bible Strong as the seller.** It keeps about six points more of each
  web sale than Managed Payments, in exchange for VAT registrations and returns in every
  customer's country.
- **Paddle first.** Also a merchant of record, but its fixed fee per transaction costs more than
  Managed Payments on a monthly price.
- **Linking the store apps to the web checkout.** It saves next to nothing, as the context shows.
  It also loses readers at every step out of the app.
- **The community StoreKit plugin for Tauri (`tauri-plugin-iap`), with transactions forwarded to
  RevenueCat's API.** It needs less native code, but it depends on a community plugin and on
  forwarding transactions ourselves. It is the fallback if the plugin over RevenueCat's Swift SDK
  fails its prototype.
- **RevenueCat Paywalls.** They would not follow the surface grammar.

## Consequences

- **Premium follows the account.** A reader who buys it on one surface has it on every surface
  where they sign in, and the assistant sees it from the next question.
- **Each sales channel keeps its own receipts, refunds and management page.** Support has to know
  where a reader subscribed, which RevenueCat shows.
- **A reader can still pay twice**, through two sales channels or two Apple IDs. Hiding the offer
  from a reader with Premium limits it, and a refund goes back through the channel that charged.
- **The store builds take on App Review's subscription requirements:** a restore button, the
  terms and privacy links, and the price and period shown before purchase.
- **RevenueCat takes 1 % of tracked revenue beyond its free threshold**, on every channel.
- **Stripe reviews the account before enabling Managed Payments**, and in some cases refunds a
  purchase made within the last 60 days on its own.
- **The Mac App Store build gains native code** (the StoreKit plugin), and its bootstrap states
  its distribution.
- **Prices per country are left for later.** Changing them on the stores does not reopen this
  decision.
