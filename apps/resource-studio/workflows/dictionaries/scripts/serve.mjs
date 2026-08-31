#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDictionaryReaderStore } from "./dictionary-reader.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(root, "../../../..");
const configPath = path.join(
  workspaceRoot,
  "apps/resource-studio/config/resource-publications/dictionary.json"
);
const port = Number(process.env.DICTIONARY_READER_PORT ?? 4178);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const json = (response, status, payload) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
};

const serveStatic = async (pathname, response) => {
  const relativePath =
    pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(`${root}${path.sep}`))
    throw new Error("Chemin refusé");
  const details = await stat(filePath);
  if (!details.isFile()) throw new Error("Introuvable");
  response.writeHead(200, {
    "Content-Type":
      mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(response);
};

const store = await createDictionaryReaderStore(configPath, {
  normalizedRoot: path.join(root, ".local/normalized")
});

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method !== "GET")
      return json(response, 405, { error: "Méthode refusée" });
    if (url.pathname === "/api/catalog")
      return json(response, 200, { dictionaries: await store.catalog() });
    if (url.pathname === "/api/entries") {
      return json(
        response,
        200,
        await store.listEntries(Object.fromEntries(url.searchParams))
      );
    }
    if (url.pathname === "/api/entry") {
      const entry = await store.getEntry(Object.fromEntries(url.searchParams));
      return entry
        ? json(response, 200, { entry })
        : json(response, 404, { error: "Entrée absente" });
    }
    await serveStatic(decodeURIComponent(url.pathname), response);
  } catch (error) {
    json(response, 404, { error: error.message ?? "Introuvable" });
  }
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Cabinet des dictionnaires : http://127.0.0.1:${port}\n`
  );
});
