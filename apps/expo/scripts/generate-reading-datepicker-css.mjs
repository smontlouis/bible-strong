import { compile } from '@tailwindcss/node'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const base = fileURLToPath(new URL('../', import.meta.url))
const source = `
@import 'tailwindcss/theme.css';
@import 'tw-animate-css';
@import '@heroui/styles/themes/shared/theme.css';
@import '@heroui/styles/themes/default/variables.css';
@import '@heroui/styles/utilities';
@import '@heroui/styles/variants';
/* HeroUI expects Tailwind preflight. Scope its relevant browser resets to these
   two roots instead of resetting React Native Web's entire document. */
@layer base {
  .reading-datepicker-theme, .reading-datepicker-theme *,
  .reading-datepicker-theme ::before, .reading-datepicker-theme ::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
  }
  .reading-datepicker-theme { line-height: 1.5; }
  .reading-datepicker-theme button, .reading-datepicker-theme input {
    font: inherit;
    letter-spacing: inherit;
    color: inherit;
    border-radius: 0;
    background-color: transparent;
    opacity: 1;
  }
  .reading-datepicker-theme button { appearance: button; }
  .reading-datepicker-theme svg { display: block; vertical-align: middle; }
  .reading-datepicker-theme table { text-indent: 0; border-color: inherit; border-collapse: collapse; }
  .reading-datepicker-theme [hidden]:not([hidden="until-found"]) { display: none !important; }
}
@import '@heroui/styles/components/date-picker.css';
@import '@heroui/styles/components/date-field.css';
@import '@heroui/styles/components/date-input-group.css';
@import '@heroui/styles/components/calendar.css';
@import '@heroui/styles/components/calendar-year-picker.css';
`
const result = await compile(source, { base, onDependency() {} })
// Limit default theme variables to the field and its portalled popover.
const css = result
  .build([])
  .replace(':root, :host {', '.reading-datepicker-theme {')
  .replace(
    /:root,\s*\.light,\s*\.default,\s*\[data-theme="light"\],\s*\[data-theme="default"\]/g,
    '.reading-datepicker-theme'
  )
  .replace(/\.dark,\s*\[data-theme="dark"\]/g, '.reading-datepicker-theme.dark')
await writeFile(
  new URL('../src/features/daily-reading/reading-datepicker.generated.web.css', import.meta.url),
  `/* Generated from installed HeroUI default styles. Run: node scripts/generate-reading-datepicker-css.mjs */\n${css}`
)
