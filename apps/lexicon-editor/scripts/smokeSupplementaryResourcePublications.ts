import { access } from "node:fs/promises";
import path from "node:path";

import { validateSupplementaryResourcePublication } from "../src/packageSupplementaryResourcePublications.js";

const root = process.env.SUPPLEMENTARY_PUBLICATION_ROOT ?? "outputs/publications/supplementary";
const bundles = [
  { resourceId: "MHY", path: process.env.MHY_BUNDLE ?? path.join(root, "mhy-fr") },
  { resourceId: "TRESOR", path: process.env.TRESOR_BUNDLE ?? path.join(root, "tresor-fr") }
];

for (const bundle of bundles) {
  await access(bundle.path);
  const manifest = await validateSupplementaryResourcePublication(bundle.path);
  if (manifest.identity.resourceId !== bundle.resourceId) {
    throw new Error(`supplementary-smoke-resource-mismatch:${bundle.resourceId}`);
  }
  console.log(JSON.stringify({ resourceId: bundle.resourceId, revision: manifest.revision, counts: manifest.counts }));
}

console.log("supplementary-publications-smoke:ok");
