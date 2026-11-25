import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  pendingUploads,
  putImmutableCopies,
  type MediaUpload
} from "./mediaUpload.js";

/**
 * The background music the audio player loops under the voice (ADR-0117): composed by ElevenLabs
 * from the prompts of config/bible-audio-music.json, turned into seamless loops at an even
 * loudness, then put on the media host. Each take is immutable: a new one gets a new `take`.
 */

const execFileAsync = promisify(execFile);

const COMPOSE_URL =
  "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128";
const MODEL = "music_v2_5";
// The last seconds fade into the first ones, so that the end leads back into the start.
const LOOP_CROSSFADE_SECONDS = 6;
// Quiet and even, under a voice read at about -16 LUFS.
const LOOP_LOUDNESS = "loudnorm=I=-23:TP=-2:LRA=11";

export type MusicPiece = {
  id: string;
  name: { fr: string; en: string };
  lengthMs: number;
  prompt: string;
};

export type MusicConfig = {
  prefix: string;
  take: string;
  pieces: MusicPiece[];
};

export const musicKey = (config: MusicConfig, id: string) =>
  `${config.prefix}/${id}-${config.take}.mp3`;

/** Composes each piece not composed yet into `<folder>/<id>.raw.mp3`, then loops it into `<id>.mp3`. */
export const generateMusic = async (
  config: MusicConfig,
  folder: string,
  only?: string
) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey)
    throw new Error("ELEVENLABS_API_KEY: set it to compose the music.");
  await mkdir(folder, { recursive: true });
  for (const piece of config.pieces) {
    if (only && piece.id !== only) continue;
    const raw = path.join(folder, `${piece.id}.raw.mp3`);
    if (!existsSync(raw)) {
      const answer = await fetch(COMPOSE_URL, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: MODEL,
          prompt: piece.prompt,
          music_length_ms: piece.lengthMs,
          force_instrumental: true
        })
      });
      if (!answer.ok)
        throw new Error(
          `ELEVENLABS_MUSIC: ${answer.status} for ${piece.id}: ${await answer.text()}`
        );
      await writeFile(raw, Buffer.from(await answer.arrayBuffer()));
      console.log(
        `Composed ${piece.id} (song ${answer.headers.get("song-id") ?? "?"}).`
      );
    }
    const loop = path.join(folder, `${piece.id}.mp3`);
    const fade = LOOP_CROSSFADE_SECONDS;
    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      raw,
      "-filter_complex",
      `[0:a]atrim=start=${fade},asetpts=PTS-STARTPTS[body];[0:a]atrim=end=${fade},asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=${fade}:c1=tri:c2=tri,${LOOP_LOUDNESS}`,
      "-ar",
      "44100",
      "-b:a",
      "128k",
      loop
    ]);
    console.log(`Looped ${piece.id} into ${loop}.`);
  }
};

const sha256 = async (file: string) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");

/** Puts the loops of `<folder>` on the media host; a ledger in the folder lets a run resume. */
export const hostMusic = async (
  config: MusicConfig,
  folder: string,
  bucket: string,
  mediaOrigin: string,
  dryRun: boolean
) => {
  const uploads: MediaUpload[] = [];
  for (const piece of config.pieces) {
    const file = path.join(folder, `${piece.id}.mp3`);
    if (!existsSync(file))
      throw new Error(
        `BIBLE_AUDIO_MUSIC_MISSING: no loop for ${piece.id} in ${folder}.`
      );
    const key = musicKey(config, piece.id);
    uploads.push({
      key,
      file,
      sha256: await sha256(file),
      url: `${mediaOrigin}/${key}`
    });
  }
  const ledgerPath = path.join(folder, `uploaded.${bucket}.json`);
  const pending = await pendingUploads(uploads, ledgerPath);
  console.log(
    `${uploads.length} pieces, ${pending.length} to put in ${bucket}.`
  );
  if (dryRun) return uploads;
  await putImmutableCopies(bucket, pending, ledgerPath, "audio/mpeg");
  return uploads;
};
