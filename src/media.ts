import { normalizePath, type App, type TFile } from "obsidian";
import type { BlogApi } from "./api/client";
import type { Media } from "./api/types";
import { mapOutsideCode } from "./markdown-code";
import { numberValue } from "./note";
import { PROPERTY_KEYS } from "./properties";
import { imageUuidName } from "./uuid";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

const IMAGE_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

export interface BodyUploadResult {
  body: string;
  warnings: string[];
}

export interface CoverUploadResult {
  mediaId: number | null | undefined;
  warnings: string[];
}

export interface MediaUploadOptions {
  /** Upload under a UUID-shaped name instead of the local file name. */
  renameToUuid: boolean;
}

type UploadCache = Map<string, Media>;

export async function uploadBodyImages(
  app: App,
  api: BlogApi,
  body: string,
  sourcePath: string,
  options: MediaUploadOptions,
): Promise<BodyUploadResult> {
  const cache: UploadCache = new Map();
  const warnings: string[] = [];

  const result = await mapOutsideCode(body, async (segment) => {
    let next = await replaceAsync(
      segment,
      /!\[\[([^\]\n]+)\]\]/g,
      async (match) => {
        const inner = match[1] ?? "";
        const [targetPart, aliasPart] = splitOnce(inner, "|");
        const target = stripSubpath(targetPart).trim();
        if (!target || !isImagePath(target)) return match[0];

        const file = resolveFile(app, target, sourcePath);
        if (!file) {
          throw new Error(`找不到图片：${target}`);
        }
        const media = await uploadFile(api, file, cache, options);
        const alias = aliasPart?.trim();
        const alt =
          alias && !/^\d+(x\d+)?$/.test(alias) ? alias : file.basename;
        return `![${escapeAlt(alt)}](${media.url})`;
      },
    );

    next = await replaceAsync(
      next,
      /!\[([^\]]*)\]\(((?:[^()\n]|\([^()\n]*\))*)\)/g,
      async (match) => {
        const alt = match[1] ?? "";
        const destination = splitDestination(match[2] ?? "");
        if (!destination) return match[0];

        const target = destination.path.trim();
        if (isRemoteOrMediaPath(target)) return match[0];
        if (!isImagePath(target)) return match[0];

        const decoded = safeDecode(target);
        const file = resolveFile(app, decoded, sourcePath);
        if (!file) {
          throw new Error(`找不到图片：${target}`);
        }
        const media = await uploadFile(api, file, cache, options);
        const tail = destination.tail ? ` ${destination.tail}` : "";
        return `![${alt}](${media.url}${tail})`;
      },
    );

    return next;
  });

  return { body: result, warnings };
}

export async function uploadCover(
  app: App,
  api: BlogApi,
  frontmatter: Record<string, unknown>,
  sourcePath: string,
  options: MediaUploadOptions,
): Promise<CoverUploadResult> {
  const hasCover =
    Object.prototype.hasOwnProperty.call(frontmatter, PROPERTY_KEYS.cover) ||
    Object.prototype.hasOwnProperty.call(frontmatter, "cover") ||
    Object.prototype.hasOwnProperty.call(frontmatter, "cover_image") ||
    Object.prototype.hasOwnProperty.call(frontmatter, "image");

  if (!hasCover) return { mediaId: undefined, warnings: [] };

  const raw =
    frontmatter[PROPERTY_KEYS.cover] ??
    frontmatter.cover ??
    frontmatter.cover_image ??
    frontmatter.image;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") {
    return { mediaId: undefined, warnings: ["封面不是图片路径，保留原封面"] };
  }

  const trimmed = value.trim();
  if (!trimmed) return { mediaId: undefined, warnings: [] };
  if (isRemoteOrMediaPath(trimmed)) {
    return {
      mediaId: numberValue(frontmatter.fsb_cover_media_id),
      warnings: [],
    };
  }

  const target = unwrapWikiLink(trimmed);
  const file = resolveFile(app, stripSubpath(target), sourcePath);
  if (!file) {
    return { mediaId: undefined, warnings: [`找不到封面：${target}`] };
  }

  try {
    const media = await uploadFile(api, file, new Map(), options);
    return { mediaId: media.id, warnings: [] };
  } catch (error) {
    return {
      mediaId: undefined,
      warnings: [
        `封面上传失败，保留原封面：${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function resolveFile(
  app: App,
  target: string,
  sourcePath: string,
): TFile | null {
  const direct = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
  if (direct) return direct;

  const normalized = normalizePath(target);
  const abstract = app.vault.getAbstractFileByPath(normalized);
  return isTFile(abstract) ? abstract : null;
}

function isTFile(value: unknown): value is TFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    "extension" in value
  );
}

async function uploadFile(
  api: BlogApi,
  file: TFile,
  cache: UploadCache,
  options: MediaUploadOptions,
): Promise<Media> {
  const cached = cache.get(file.path);
  if (cached) return cached;

  const extension = file.extension.toLocaleLowerCase();
  const mimeType = MIME_TYPES[extension];
  if (!mimeType) {
    throw new Error(`不支持这种图片格式：${file.name}`);
  }
  if (file.stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`图片超过 10 MB：${file.name}`);
  }

  let bytes: ArrayBuffer | undefined;
  let uploadName = file.name;
  if (options.renameToUuid) {
    bytes = await file.vault.readBinary(file);
    uploadName = await imageUuidName(file.name, bytes);
  }

  const existing = await findExistingMedia(api, uploadName, file.stat.size);
  if (existing) {
    cache.set(file.path, existing);
    return existing;
  }

  if (!bytes) bytes = await file.vault.readBinary(file);
  const media = await api.uploadMedia(uploadName, mimeType, bytes);
  cache.set(file.path, media);
  return media;
}

async function findExistingMedia(
  api: BlogApi,
  fileName: string,
  sizeInBytes: number,
): Promise<Media | null> {
  try {
    const page = await api.listMedia({ search: fileName, limit: 50 });
    return (
      page.items.find(
        (item) =>
          item.fileName === fileName && item.sizeInBytes === sizeInBytes,
      ) ?? null
    );
  } catch {
    // A failed lookup should not stop an upload; the upload may still work.
    return null;
  }
}

export async function uploadVaultImage(
  api: BlogApi,
  file: TFile,
  options: MediaUploadOptions,
): Promise<Media> {
  return uploadFile(api, file, new Map(), options);
}

function isImagePath(value: string): boolean {
  const withoutQuery = value.split(/[?#]/)[0] ?? value;
  const extension = withoutQuery.split(".").pop()?.toLocaleLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(extension);
}

function isRemoteOrMediaPath(value: string): boolean {
  return /^(?:https?:|data:|app:|file:|\/images\/)/i.test(value);
}

function stripSubpath(value: string): string {
  return value.split("#")[0] ?? value;
}

function unwrapWikiLink(value: string): string {
  const match = value.match(/^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  return match?.[1]?.trim() ?? value;
}

function splitOnce(value: string, separator: string): [string, string | undefined] {
  const index = value.indexOf(separator);
  if (index < 0) return [value, undefined];
  return [value.slice(0, index), value.slice(index + separator.length)];
}

function splitDestination(
  raw: string,
): { path: string; tail: string } | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    if (end < 0) return null;
    return { path: value.slice(1, end), tail: value.slice(end + 1).trim() };
  }

  const space = value.search(/\s/);
  if (space < 0) return { path: value, tail: "" };

  const tail = value.slice(space + 1).trim();
  // A space does not always separate a title: Obsidian and many editors leave
  // spaces in paths. Only treat the rest as a title when it has a title's
  // shape ("...", '...' or (...)).
  if (!/^(?:"[^"]*"|'[^']*'|\([^)]*\))$/.test(tail)) {
    return { path: value, tail: "" };
  }
  return { path: value.slice(0, space), tail };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeAlt(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

async function replaceAsync(
  input: string,
  regex: RegExp,
  replacer: (match: RegExpMatchArray) => Promise<string>,
): Promise<string> {
  const matches = [...input.matchAll(regex)];
  if (matches.length === 0) return input;

  let result = "";
  let lastIndex = 0;
  for (const match of matches) {
    const index = match.index ?? 0;
    result += input.slice(lastIndex, index);
    result += await replacer(match);
    lastIndex = index + match[0].length;
  }
  return result + input.slice(lastIndex);
}
