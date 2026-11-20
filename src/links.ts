import type { App, TFile } from "obsidian";
import type { BlogApi } from "./api/client";
import { mapOutsideCode } from "./markdown-code";
import { numberValue, parseNote, stringValue } from "./note";

export interface WikiLinkResult {
  body: string;
  warnings: string[];
}

export async function convertWikiLinks(
  app: App,
  api: BlogApi,
  body: string,
  sourcePath: string,
): Promise<WikiLinkResult> {
  const warnings: string[] = [];

  const result = await mapOutsideCode(body, (segment) =>
    replaceAsync(segment, /(?<!!)\[\[([^\]\n]+)\]\]/g, async (match) => {
      const inner = match[1] ?? "";
      const [targetWithAnchor, alias] = splitOnce(inner, "|");
      const [notePart, headingPart] = splitOnce(targetWithAnchor, "#");
      const target = notePart.trim();
      const heading = headingPart?.trim();
      const aliasText = alias?.trim();

      if (!target) {
        if (!heading) return match[0];
        const suffix = slugifyHeading(heading);
        return `[${escapeText(aliasText || heading)}](#${suffix})`;
      }

      const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
      const display =
        aliasText ||
        (heading
          ? `${file?.basename ?? target} > ${heading}`
          : (file?.basename ?? target));

      if (!file) {
        warnings.push(`找不到笔记「${target}」，已转成纯文本。`);
        return escapeText(display);
      }

      const url = await postUrlFor(app, api, file);
      if (!url) {
        warnings.push(`笔记「${target}」还没有发布，已转成纯文本。`);
        return escapeText(display);
      }

      const anchor = heading ? `#${slugifyHeading(heading)}` : "";
      return `[${escapeText(display)}](${url}${anchor})`;
    }),
  );

  return { body: result, warnings };
}

async function postUrlFor(
  app: App,
  api: BlogApi,
  file: TFile,
): Promise<string | null> {
  let frontmatter = app.metadataCache.getFileCache(file)?.frontmatter as
    | Record<string, unknown>
    | undefined;

  if (!stringValue(frontmatter?.fsb_url)) {
    try {
      frontmatter = parseNote(await app.vault.read(file)).frontmatter;
    } catch {
      // Keep the cached frontmatter when the file cannot be read.
    }
  }

  const storedUrl = stringValue(frontmatter?.fsb_url);
  if (storedUrl) return storedUrl;

  const slug = stringValue(frontmatter?.slug);
  const postId = numberValue(frontmatter?.fsb_post_id);
  if (slug && postId !== undefined) {
    return `${api.siteOrigin}/post/${encodeURIComponent(slug)}`;
  }
  return null;
}

function slugifyHeading(text: string): string {
  const cleaned = text
    .normalize("NFKC")
    .toLowerCase()
    .split("ß")
    .join("ss")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\-\u4E00-\u9FA5]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return cleaned || "heading";
}

function escapeText(value: string): string {
  return value.replace(/([\[\]])/g, "\\$1");
}

function splitOnce(
  value: string,
  separator: string,
): [string, string | undefined] {
  const index = value.indexOf(separator);
  if (index < 0) return [value, undefined];
  return [value.slice(0, index), value.slice(index + separator.length)];
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
