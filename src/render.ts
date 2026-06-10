import { type AlignmentResult } from "./align.js";
import { escapeHtml } from "./tokenize.js";

export function renderTaggedText(result: AlignmentResult): string {
  let wordIndex = -1;
  let output = "";

  for (const segment of result.segments) {
    if (segment.kind === "text") {
      output += escapeHtml(segment.text);
      continue;
    }

    wordIndex += 1;
    const assignment = result.assignments.get(wordIndex);

    if (!assignment) {
      output += escapeHtml(segment.text);
      continue;
    }

    output += `<w strong="${escapeHtml(assignment.strong.join(" "))}" data-confidence="${assignment.confidence.toFixed(
      2
    )}" data-source="${escapeHtml(assignment.source)}" data-method="${
      assignment.method
    }">${escapeHtml(segment.text)}</w>`;
  }

  return output;
}

export function tsvEscape(input: string): string {
  return input.replace(/\t/g, " ").replace(/\r?\n/g, "\\n");
}
