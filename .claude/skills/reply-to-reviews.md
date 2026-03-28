---
name: reply-to-reviews
description: Fetch Google Play reviews and reply to them intelligently based on language and sentiment
user_invocable: true
---

# Reply to Google Play Reviews

You are responding to Google Play Store reviews for the Bible Strong app. Follow this process exactly.

## Step 1: Fetch reviews

Run this command to get all unreplied reviews:

```bash
npx tsx scripts/fetch-reviews.ts --unreplied-only
```

If there are no unreplied reviews, tell the user and stop.

## Step 2: Generate replies

For each review, generate an appropriate reply following these rules:

### Language
- Reply in the **same language** as the reviewer. Detect the language from the `language` field and the review text.
- Most reviews will be in French (`fr`) or English (`en`), but adapt to any language.

### Tone and content based on rating

**5 stars / 4 stars (positive):**
- Thank them warmly for their review and support
- Keep it short, genuine, and personal (not generic/corporate)
- If they mention a specific feature they like, acknowledge it

**3 stars (mixed):**
- Thank them for the feedback
- If they mention something missing or a suggestion, say you take note of it
- Encourage them to contact stephane@lestudio316.com for detailed feedback

**1-2 stars (negative / complaint):**
- Empathize with their frustration
- Say the team is actively working on improving the app
- Ask them to send details to **stephane@lestudio316.com** so the issue can be investigated
- Never be defensive or dismissive

### Constraints
- **Max 350 characters** per reply (Google Play limit). This is strict — count carefully.
- Be concise but warm. No filler.
- Never mention "AI" or "Claude" — you are responding as the Bible Strong team.
- Do not use emojis excessively. One max per reply if appropriate.
- Sign as "L'equipe Bible Strong" (French) or "The Bible Strong team" (other languages)

### Example replies

**French 5-star:**
> Merci beaucoup pour votre avis ! Nous sommes ravis que Bible Strong vous accompagne dans votre etude de la Bible. - L'equipe Bible Strong

**French 1-star complaint about a bug:**
> Nous sommes desoles pour ce desagrement. Notre equipe travaille activement a corriger ce probleme. N'hesitez pas a nous ecrire a stephane@lestudio316.com avec les details pour qu'on puisse vous aider. - L'equipe Bible Strong

**English 5-star:**
> Thank you so much for your kind review! We're glad Bible Strong is helping you in your Bible study. - The Bible Strong team

**English 2-star complaint:**
> We're sorry about your experience. Our team is actively working on improvements. Please email us at stephane@lestudio316.com with details so we can help. - The Bible Strong team

## Step 3: Present for approval

Present ALL generated replies in a clear table format:

```
| # | Stars | Language | Author | Review (truncated) | Proposed Reply |
```

Ask the user to confirm before sending. They can:
- Approve all
- Approve individually by number
- Edit specific replies
- Skip specific reviews

## Step 4: Send approved replies

For each approved reply, run:

```bash
npx tsx scripts/send-review-reply.ts "<reviewId>" "<replyText>"
```

**Important:** Add a 500ms pause between each send to respect rate limits.

Report the results: how many sent successfully, how many failed.
