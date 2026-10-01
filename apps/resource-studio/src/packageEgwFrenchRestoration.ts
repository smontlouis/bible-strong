import { mkdir, readFile, rm, copyFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRestoredEgwFrenchCanonical } from "./egwFrenchRestoration.js";
import {
  buildCommentaryPublicationBundle,
  prepareCatalogContractReplacements,
  type CatalogResource
} from "./packageCommentaryResourcePublications.js";
import {
  commitResourcePublicationTransaction,
  type ResourcePublicationReplacement
} from "./resourcePublicationCommit.js";

export async function packageEgwFrenchRestoration({
  restorationRoot,
  outputRoot,
  updateCatalog = false
}: {
  restorationRoot: string;
  outputRoot: string;
  updateCatalog?: boolean;
}) {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  const catalog = JSON.parse(
    await readFile(
      path.join(
        repositoryRoot,
        "apps/resource-studio/workflows/commentaries/data/catalog.json"
      ),
      "utf8"
    )
  ) as { resources: CatalogResource[] };
  const resource = catalog.resources.find(
    (entry) => entry.id === "egw-writings"
  );
  if (!resource || !resource.languages.includes("fr"))
    throw new Error("egw-french-catalog-missing");
  const canonical = await loadRestoredEgwFrenchCanonical(restorationRoot);
  const summary = JSON.parse(
    await readFile(path.join(restorationRoot, "manifest.json"), "utf8")
  ) as { generatedAt: string };
  const staging = `${outputRoot}.tmp-${randomUUID()}`;
  try {
    const bundle = await buildCommentaryPublicationBundle(
      staging,
      resource,
      "fr",
      canonical,
      summary.generatedAt
    );
    await mkdir(path.join(bundle.bundlePath, "provenance"));
    await copyFile(
      path.join(restorationRoot, "manifest.json"),
      path.join(bundle.bundlePath, "provenance/restoration.json")
    );
    await copyFile(
      path.join(restorationRoot, "provenance.json"),
      path.join(bundle.bundlePath, "provenance/paragraphs.json")
    );
    const replacements: ResourcePublicationReplacement[] = [
      {
        preparedPath: bundle.bundlePath,
        targetPath: path.join(outputRoot, "egw-writings-fr"),
        replaceExisting: true
      }
    ];
    if (updateCatalog)
      replacements.push(
        ...(await prepareCatalogContractReplacements(
          catalog.resources,
          [{ catalogResource: resource, language: "fr", ...bundle }],
          path.join(staging, "catalog")
        ))
      );
    await commitResourcePublicationTransaction({ replacements });
    const result = {
      bundlePath: path.join(outputRoot, "egw-writings-fr"),
      revision: canonical.revision,
      paragraphs: canonical.documents.length,
      verses: canonical.verses.length,
      catalogUpdated: updateCatalog,
      productionWrites: false
    };
    await writeFile(
      path.join(outputRoot, "egw-french-restoration-result.json"),
      JSON.stringify(result, null, 2) + "\n"
    );
    return result;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

const main = async () => {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  const options = {
    "--restoration-root": path.join(
      repositoryRoot,
      "apps/resource-studio/workflows/commentaries/.local/egw-french-restoration"
    ),
    "--output-root": path.join(
      repositoryRoot,
      "apps/resource-studio/outputs/resource-publications/commentaries"
    )
  };
  const args = process.argv.slice(2);
  let updateCatalog = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--update-catalog") updateCatalog = true;
    else if (args[i] in options && args[i + 1] && !args[i + 1].startsWith("--"))
      options[args[i] as keyof typeof options] = path.resolve(args[++i]);
    else throw new Error(`Invalid option: ${args[i]}`);
  }
  console.log(
    JSON.stringify(
      await packageEgwFrenchRestoration({
        restorationRoot: options["--restoration-root"],
        outputRoot: options["--output-root"],
        updateCatalog
      }),
      null,
      2
    )
  );
};
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
