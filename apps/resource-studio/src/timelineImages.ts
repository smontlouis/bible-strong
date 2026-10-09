import { createHash } from "node:crypto";

/** Where the timeline's publisher serves the pictures its events name. */
export const TIMELINE_IMAGE_SOURCE_URL =
  "https://timeline.biblehistory.com/media/images/original/";

/** The public media bucket, served at https://media.bible-strong.app (ADR-0080). */
export const TIMELINE_IMAGE_BUCKET = "bible-strong-media-prod";

/** The folder of the copies in that bucket. */
export const TIMELINE_IMAGE_KEY_PREFIX = "timeline-images";

/**
 * Widths the copies are served at, besides the original. 480 fills a card of the drawn timeline
 * on a dense screen; 1200 fills a share image and the reading column.
 */
export const TIMELINE_IMAGE_WIDTHS = [480, 1200] as const;
export type TimelineImageWidth = (typeof TIMELINE_IMAGE_WIDTHS)[number];
export type TimelineImageVariant = "original" | `w${TimelineImageWidth}`;

// An event names a plain file. Anything else is not a picture of the publication.
const IMAGE_FILE_PATTERN = /^[^/\\]+\.(?:jpe?g|png|gif|webp)$/iu;

export const isTimelineImageFile = (file: string): boolean =>
  IMAGE_FILE_PATTERN.test(file);

export const timelineImageSourceUrl = (file: string): string =>
  `${TIMELINE_IMAGE_SOURCE_URL}${encodeURIComponent(file)}`;

/** The resized copies are WebP and say so after the name the events know. */
export const timelineImageKey = (
  variant: TimelineImageVariant,
  file: string
): string =>
  `${TIMELINE_IMAGE_KEY_PREFIX}/${variant}/${file}${variant === "original" ? "" : ".webp"}`;

export type ImageKind = "jpeg" | "png" | "gif" | "webp";
export type ImageSize = { kind: ImageKind; width: number; height: number };

const MEDIA_TYPES: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp"
};

export const imageMediaType = (kind: ImageKind): string => MEDIA_TYPES[kind];

const jpegSize = (bytes: Uint8Array): ImageSize | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1];
    // Start-of-frame markers carry the size; C4, C8 and CC are tables, not frames.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        kind: "jpeg",
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7)
      };
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return undefined;
};

/**
 * Reads what a file is from its first bytes, whatever its name says. A provider that answers a
 * page instead of a picture, with a success status, is caught here.
 */
export const readImageSize = (bytes: Uint8Array): ImageSize | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8)
    return jpegSize(bytes);
  if (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return {
      kind: "png",
      width: view.getUint32(16),
      height: view.getUint32(20)
    };
  }
  if (
    bytes.length > 10 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return {
      kind: "gif",
      width: view.getUint16(6, true),
      height: view.getUint16(8, true)
    };
  }
  return undefined;
};

/** A copy is never wider than its original: a small picture is re-encoded, not enlarged. */
export const resizedWidth = (
  sourceWidth: number,
  target: TimelineImageWidth
): number => Math.min(sourceWidth, target);

export const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export type TimelineImageRecord = {
  file: string;
  bytes: number;
  sha256: string;
  kind: ImageKind;
  width: number;
  height: number;
};

export type TimelineImageManifest = {
  source: string;
  images: TimelineImageRecord[];
  /** Files the events name and the publisher no longer has. */
  missing: string[];
};

/** The pictures every event of a timeline names, each once, in a stable order. */
export const timelineImageFiles = (
  events: readonly { images?: readonly { file?: unknown }[] }[]
): string[] =>
  [
    ...new Set(
      events.flatMap((event) =>
        (event.images ?? []).flatMap((image) =>
          typeof image.file === "string" && isTimelineImageFile(image.file)
            ? [image.file]
            : []
        )
      )
    )
  ].sort();
