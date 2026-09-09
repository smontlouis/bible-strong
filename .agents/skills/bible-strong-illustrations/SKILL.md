---
name: bible-strong-illustrations
description: Create or adapt Bible Strong illustrations in the house style of flat colors, monochromatic characters, and fine detail lines. Use for Illustrated Worlds, Univers illustrés, bible-strong-univers-v1, or scenes matching the site and onboarding illustrations. Not for interface mockups, logos, or UI icons.
---

# Bible Strong Illustrations

Produce a scene consistent with **Bible Strong Illustrated Worlds**, respecting the requested subject and usage. This skill provides art direction; the `imagegen` skill provides the generation and editing workflow.

## Load the Reference

This skill belongs to the Bible Strong repository. Resolve the following paths from the skill directory, even when the working directory is elsewhere: the repository root is three levels above.

- Read the [style guide](../../../docs/design/illustrations.md): the source of truth for invariants, color worlds, the gallery, and the master prompt.
- Consult the [brand guidelines](../../../docs/charte-graphique.md) for brand or interface integration questions.
- Gallery images live in [`apps/site/public/images/landing/`](../../../apps/site/public/images/landing/). Resolve their paths from the repository; do not depend on a personal `/Users/...` path.

Keep detailed rules and examples in the documentation rather than duplicating them in the skill. If a reference is missing, search the repository for its new location and explain what is unavailable before claiming to reproduce the style.

## Build the Scene

From the request, determine the main action, placement, aspect ratio, and color world. Reuse information already provided; choose reasonable defaults when sufficient. When proposing a color for a feature absent from the table, identify it as a choice for this brief rather than an existing official color.

Select one or two relevant illustrations from the gallery, inspect them, and attach them to generation. Identify their roles: drawing, palette, or composition reference. A style reference is not an instruction to copy the entire character or scene. For edits, distinguish the target image from supporting references and specify what to preserve.

Carry these constraints into the prompt:

- Large rounded color masses, monochromatic characters, and simple expressions.
- **No systematic outer outline; retain fine lines for faces, hands, and objects.** “Without outlines” does not mean removing all drawn details.
- A readable gesture, one main object, and a limited palette; accessories explain the function.
- A genuinely transparent background by default. A viewer's black background and export halos are not part of the style.
- Historical images may have subtle grain or stronger lines; do not amplify those deviations.

Adapt the guide's master prompt to the subject. Explicit user choices override defaults. Do not add quotations, readable text, logos, or scenery absent from the brief. If Greek or Hebrew is requested, supply and check the exact spelling.

## Generate, Check, and Deliver

To create or edit an image, load the available `imagegen` skill and use its built-in tool by default. Do not switch to an API, CLI, or another model without an explicit request. If the tool is unavailable, explain the limitation; do not silently substitute SVG or an HTML mockup. A request for a prompt or analysis alone does not trigger generation.

Compare the output with the references: shapes and lines, dominant color, action, anatomy, readability at the target size, transparency, and clean edges on light and dark backgrounds. Correct concrete deviations while preserving satisfactory elements. Attached references improve consistency but do not guarantee identical results.

Follow `imagegen` save rules. For project-bound deliverables, keep the final file in the repository with the exact prompt, reference filenames, and `bible-strong-univers-v1` identifier. Preserve originals and keep alpha when exporting PNG or WebP.

Creating an illustration does not imply replacing existing assets, changing the interface, or publishing the site. Integrate the image only when requested. Show the result and its path, noting any validation limitations.

## Invocation Examples

- “Use $bible-strong-illustrations for a square note-taking scene with a transparent background.”
- “With $bible-strong-illustrations, propose three illustrations for comparing Bible versions.”
- “Use $bible-strong-illustrations to adapt this scene to the Comparison world's violet palette while preserving its composition.”
