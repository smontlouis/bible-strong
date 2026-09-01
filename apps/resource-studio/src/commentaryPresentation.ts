// This module intentionally contains browser-compatible JavaScript. The local
// Commentary Cabinet serves it directly, while the publication packager imports
// the same source through TypeScript.

export const SDABC_EGW_HEADING = "Ellen G. White";

/**
 * Builds the reader-visible SDABC presentation for one passage and language.
 * Scripture-index entries are discovery metadata and never become commentary.
 * Input order is retained within the general and EGW sections, but the general
 * section is always projected first.
 */
// @ts-expect-error -- This signature must remain valid browser JavaScript.
export const projectSdabcContent = (parts) => {
  let generalHtml = "";
  let supplementHtml = "";
  for (const part of parts) {
    if (
      part.layer === "egw-scripture-index" ||
      typeof part.html !== "string" ||
      !part.html.trim()
    ) {
      continue;
    }
    if (part.layer === "egw-supplement") {
      supplementHtml += `${supplementHtml ? "<hr>" : ""}${part.html}`;
    } else {
      generalHtml += `${generalHtml ? "<hr>" : ""}${part.html}`;
    }
  }

  if (supplementHtml) {
    const section = `<br><br><h3>${SDABC_EGW_HEADING}</h3><br>${supplementHtml}`;
    return `${generalHtml}${generalHtml ? "<hr>" : ""}${section}`;
  }
  return generalHtml;
};
