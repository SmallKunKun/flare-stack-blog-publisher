import { normalizePath, stringifyYaml, type App, type TFile } from "obsidian";
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
    title,
    slug: form.slug.trim(),
    summary: form.summary.trim(),
    category: form.category.trim(),
    tags: form.tags,
    cover: form.cover.trim(),
    ...(form.publishedAt ? { publishedAt: form.publishedAt } : {}),
  };
  const content = `---\n${stringifyYaml(frontmatter)}---\n\n`;

  await ensureFolder(app, postFolder);
  return writeNote(app, path, content);
}
