# Bible Strong Brand Guidelines

These guidelines document the visual identity shared by the Bible Strong public site and application. The first chapter formalizes existing illustrations; it is not yet a complete specification of logos, typography, or components.

## Illustration Styles

| Style                                                                | Reusable identifier       | Usage                                                      | Reference                                              |
| -------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| **Bible Strong Illustrated Worlds** (Univers illustrés Bible Strong) | `bible-strong-univers-v1` | Feature introductions, onboarding, and educational support | [Rules, gallery, and prompts](design/illustrations.md) |

This style depicts people reading, comparing, connecting, or exploring Scripture. Large colored shapes, monochromatic characters, and fine detail lines make each gesture readable. The tone is warm, human, and thoughtful.

To request an illustration:

> Create an illustration in the `bible-strong-univers-v1` style defined in `docs/design/illustrations.md`. Subject: [action]. Color world: [world]. Format and placement: [usage]. Use the visual references listed in the guide.

The style identifier is a documentation shortcut: provide the guide and reference images to the generator. It is not a trained model or a preset automatically loaded by an image tool.

The repository skill [`bible-strong-illustrations`](../.agents/skills/bible-strong-illustrations/SKILL.md) reads the guide, selects references, and uses `imagegen`. Example:

> Use $bible-strong-illustrations to create a square illustration of someone taking notes, on a transparent background.

## Relationship to the Interface

Illustration colors support the narrative. They do not replace interface tokens and should not be copied arbitrarily into buttons, text, or interactive states.

- Expo application: palettes in [`apps/expo/src/themes/`](../apps/expo/src/themes/), following [ADR-0040](adr/0040-use-uniwind-for-expo-styles.md).
- Public site: styles and variables in [`apps/site/src/styles.css`](../apps/site/src/styles.css).
- Reference illustrations: existing files in [`apps/site/public/images/landing/`](../apps/site/public/images/landing/).

Illustrations accompany the content. Labels, quotations, and controls remain interface text to preserve readability, translation, and accessibility.

## Maintaining the Guidelines

Write these guidelines, style guides, skill instructions, and generation examples in English, consistent with the repository's technical documentation. Keep brand names, tool names, identifiers, paths, and configuration keys unchanged. User-facing text inside an illustration follows the requested language; documentation language does not determine product language.

A new scene can retain `bible-strong-univers-v1` as long as it respects the style invariants. Deliberate changes to silhouettes, line treatment, or the overall palette should be documented as a style evolution with comparative examples. An image filename's version number does not identify a version of these guidelines.
