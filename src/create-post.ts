import { normalizePath, stringifyYaml, type App, type TFile } from "obsidian";
import { PROPERTY_KEYS } from "./properties";
import {
  ensureFolder,
  normalizeFolder,
  safeName,
  uniqueChildFolder,
  writeNote,
} from "./vault-paths";

export interface NewPostForm {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  slug: string;
  cover: string;
  coverMediaId?: number;
  publishedAt: string;
}

export async function createPostNote(
  app: App,
  folder: string,
  form: NewPostForm,
): Promise<TFile> {
  const base = normalizeFolder(folder, "FlareStackBlog/Drafts");
  const title = form.title.trim();
  const name = safeName(title, "未命名文章");
  const postFolder = uniqueChildFolder(app, base, name);
  const path = normalizePath(`${postFolder}/${name}.md`);

  const frontmatter = {
    [PROPERTY_KEYS.title]: title,
    [PROPERTY_KEYS.cover]: form.cover.trim(),
    ...(form.coverMediaId !== undefined
      ? { fsb_cover_media_id: form.coverMediaId }
      : {}),
    [PROPERTY_KEYS.category]: form.category.trim(),
    [PROPERTY_KEYS.tags]: form.tags,
    [PROPERTY_KEYS.slug]: form.slug.trim(),
    ...(form.publishedAt
      ? { [PROPERTY_KEYS.publishedAt]: form.publishedAt }
      : {}),
    [PROPERTY_KEYS.summary]: form.summary.trim(),
  };
  const content = `---\n${stringifyYaml(frontmatter)}---\n\n`;

  await ensureFolder(app, postFolder);
  return writeNote(app, path, content);
}
