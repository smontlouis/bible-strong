import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

interface StepDownload {
  fileName: string;
  url: string;
}

const STEP_ORIGINAL_FILES: StepDownload[] = [
  {
    fileName: "TAHOT Gen-Deu.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators Amalgamated OT+NT/TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt"
  },
  {
    fileName: "TAHOT Jos-Est.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators Amalgamated OT+NT/TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt"
  },
  {
    fileName: "TAHOT Job-Sng.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators Amalgamated OT+NT/TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt"
  },
  {
    fileName: "TAHOT Isa-Mal.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators Amalgamated OT+NT/TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt"
  },
  {
    fileName: "TAGNT Mat-Jhn.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators Amalgamated OT+NT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt"
  },
  {
    fileName: "TAGNT Act-Rev.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators Amalgamated OT+NT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt"
  }
];

async function main(): Promise<void> {
  const outputDir = parseOutputDir(process.argv.slice(2));
  await mkdir(outputDir, { recursive: true });

  for (const file of STEP_ORIGINAL_FILES) {
    const outputPath = path.join(outputDir, file.fileName);
    if (existsSync(outputPath)) {
      console.log(`exists ${outputPath}`);
      continue;
    }

    console.log(`download ${file.fileName}`);
    await downloadFile(file.url, outputPath);
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const body = response.body;

  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(outputPath);
    body
      .pipeTo(
        new WritableStream<Uint8Array>({
          write(chunk) {
            file.write(Buffer.from(chunk));
          },
          close() {
            file.end(resolve);
          },
          abort(error) {
            file.destroy();
            reject(error);
          }
        })
      )
      .catch(reject);
  });
}

function parseOutputDir(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output-dir") return argv[index + 1] ?? defaultOutputDir();
    if (arg?.startsWith("--output-dir=")) return arg.split("=", 2)[1] ?? "";
  }
  return defaultOutputDir();
}

function defaultOutputDir(): string {
  return "data/external/stepbible/amalgamated";
}

await main();
