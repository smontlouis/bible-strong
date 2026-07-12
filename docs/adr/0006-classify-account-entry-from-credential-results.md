# Classify account entry from credential results

Account-entry ownership is classified from the authentication operation that initiated the session: successful email registration and provider credential results explicitly marked as new establish a genuinely new account, while login, provider linking, and restored sessions do not. Missing or contradictory metadata produces an unknown classification that gates both adoption and hydration; account timestamps and empty Firestore data are diagnostic only because treating them as proof could leak guest data into an existing account.
