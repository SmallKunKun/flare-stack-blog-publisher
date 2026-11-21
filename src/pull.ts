import {
  normalizePath,
  stringifyYaml,
  TFile,
  type App,
} from "obsidian";
import type { BlogApi } from "./api/client";
import type { AdminPost, AdminPostListItem } from "./api/types";
import { mapOutsideCode } from "./markdown-code";
import { numberValue, parseNote } from "./note";
import { absoluteMediaUrl } from "./media-url";
import { PROPERTY_KEYS } from "./properties";
import { beijingIsoNow, toBeijingIso } from "./time";
import {
  ensureFolder,
  normalizeFolder,
  parentFolder,
  safeName,
  writeNote,
} from "./vault-paths";

/**
 * The folder that holds one subfolder per pulled post.
 */
function normalizePullFolder(value: string): string {
  return normalizeFolder(value, "FlareStackBlog");
}

export async function localPostIds(
  app: App,
  pullFolder: string,
): Promise<Set<number>> {
  const ids = new Set<number>();
  const prefix = `${normalizePullFolder(pullFolder)}/`;
  for (const file of app.vault.getMarkdownFiles()) {
    let id = numberValue(frontmatterOf(app, file)?.fsb_post_id);
    if (id === undefined && file.path.startsWith(prefix)) {
      id = numberValue((await readFrontmatter(app, file))?.fsb_post_id);
    }
    if (id !== undefined) ids.add(id);
  }
  return ids;
}

export async function findLocalPostFile(
  app: App,
  pullFolder: string,
  postId: number,
): Promise<TFile | null> {
  const prefix = `${normalizePullFolder(pullFolder)}/`;
  for (const file of app.vault.getMarkdownFiles()) {
    let id = numberValue(frontmatterOf(app, file)?.fsb_post_id);
    if (id === undefined && file.path.startsWith(prefix)) {
      id = numberValue((await readFrontmatter(app, file))?.fsb_post_id);
    }
    if (id === postId) return file;
  }
  return null;
}

export async function pullPostToLocal(
  app: App,
  api: BlogApi,
  item: AdminPostListItem,
  pullFolder: string,
  existingFile?: TFile | null,
): Promise<TFile> {
  const post = await api.getPost(item.id);
  const content = await buildNoteContent(api, post, item);
  const path = existingFile
    ? existingFile.path
    : chooseTargetPath(app, pullFolder, post);

  await ensureFolder(app, parentFolder(path));
  return writeNote(app, path, content);
}

async function buildNoteContent(
  api: BlogApi,
  post: AdminPost,
  item: AdminPostListItem,
): Promise<string> {
  const publicSlug =
    post.publicSlug ?? (post.status === "published" ? post.slug : null);
  const publishedAt = post.publishedAt ?? post.published?.publishedAt ?? null;
  // The single-post response only carries categoryId. The list item carries
  // the category name, and the draft's tags.
  const tags = post.tags && post.tags.length > 0 ? post.tags : item.tags;
  const coverUrl = post.cover?.url
    ? absoluteMediaUrl(api.siteOrigin, post.cover.url)
    : "";
  const frontmatter: Record<string, unknown> = {
    [PROPERTY_KEYS.title]: post.title,
    [PROPERTY_KEYS.cover]: coverUrl,
    [PROPERTY_KEYS.category]: item.category?.name ?? "",
    [PROPERTY_KEYS.tags]: tags.map((tag) => tag.name),
    ...(post.slug ? { [PROPERTY_KEYS.slug]: post.slug } : {}),
    ...(publishedAt
      ? { [PROPERTY_KEYS.publishedAt]: toBeijingIso(publishedAt) }
      : {}),
    ...(post.summary ? { [PROPERTY_KEYS.summary]: post.summary } : {}),
    fsb_post_id: post.id,
    ...(publicSlug
      ? {
          fsb_url: `${api.siteOrigin}/post/${encodeURIComponent(publicSlug)}`,
        }
      : {}),
    fsb_pulled_at: beijingIsoNow(),
  };

  const body = (
    await mapOutsideCode(post.contentMarkdown ?? "", async (segment) =>
      absolutizeLinks(segment, api.siteOrigin),
    )
  ).trim();
  return `---\n${stringifyYaml(frontmatter)}---\n\n${body}${body ? "\n" : ""}`;
}

function chooseTargetPath(
  app: App,
  pullFolder: string,
  post: AdminPost,
): string {
  const base = normalizePullFolder(pullFolder);
  const slug = safeName(
    post.slug || `post-${post.id}`,
    `post-${post.id}`,
  );
  const title = safeName(
    post.title || post.slug || `post-${post.id}`,
    `post-${post.id}`,
  );

  let folder = `${base}/${slug}`;
  if (hasAnotherPost(app, folder, post.id)) {
    folder = `${base}/${slug}-${post.id}`;
  }

  let path = normalizePath(`${folder}/${title}.md`);
  if (fileBelongsToAnotherPost(app, path, post.id)) {
    path = normalizePath(`${folder}/${title}-${post.id}.md`);
  }
  return path;
}

function hasAnotherPost(app: App, folder: string, postId: number): boolean {
  const prefix = `${normalizePath(folder)}/`;
  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(prefix)) continue;
    const id = numberValue(frontmatterOf(app, file)?.fsb_post_id);
    if (id !== undefined && id !== postId) return true;
  }
  return false;
}

function fileBelongsToAnotherPost(
  app: App,
  path: string,
  postId: number,
): boolean {
  const existing = app.vault.getAbstractFileByPath(path);
  if (!existing) return false;
  if (!(existing instanceof TFile)) return true;
  const id = numberValue(frontmatterOf(app, existing)?.fsb_post_id);
  return id !== postId;
}

function frontmatterOf(
  app: App,
  file: TFile,
): Record<string, unknown> | undefined {
  return app.metadataCache.getFileCache(file)?.frontmatter as
    | Record<string, unknown>
    | undefined;
}

/**
 * The metadata cache can lag behind a note created moments ago, so fall back
 * to reading and parsing the file.
 */
async function readFrontmatter(
  app: App,
  file: TFile,
): Promise<Record<string, unknown> | undefined> {
  const cached = frontmatterOf(app, file);
  if (cached) return cached;
  try {
    return parseNote(await app.vault.read(file)).frontmatter;
  } catch {
    return undefined;
  }
}

/**
 * Root-relative media and post links are made absolute so they render in
 * Obsidian. The blog accepts its own /images/... addresses on save.
 */
function absolutizeLinks(body: string, origin: string): string {
  return body
    .replace(/(\]\()(\/(?:images|post|moments)\/)/g, `$1${origin}$2`)
    .replace(
      /((?:src|poster)=["'])(\/(?:images|post|moments)\/)/g,
      `$1${origin}$2`,
    );
}
