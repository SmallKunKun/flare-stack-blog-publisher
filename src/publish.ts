import type { App, TFile } from "obsidian";
import type { BlogApi } from "./api/client";
import { BlogApiError } from "./api/errors";
import type { AdminPost, UpdatePostData } from "./api/types";
import type { PublisherSettings } from "./settings";
import {
  notePostId,
  noteSlug,
  noteSummary,
  noteTitle,
  parseNote,
} from "./note";
import { PostPickerModal, type PostPickerChoice } from "./post-picker";

export type PublishMode = "publish" | "draft";

export interface PublishOutcome {
  postId: number;
  postUrl: string | null;
  created: boolean;
  published: boolean;
  title: string;
}

interface PublishContext {
  app: App;
  api: BlogApi;
  settings: PublisherSettings;
}

export async function publishNote(
  context: PublishContext,
  file: TFile,
  mode: PublishMode,
): Promise<PublishOutcome | null> {
  const { app, api } = context;
  const raw = await app.vault.read(file);
  const note = parseNote(raw);
  const title = noteTitle(note.frontmatter, file.basename);

  if (!title) {
    throw new Error("笔记标题为空。");
  }

  const body = note.body;
  const summary = noteSummary(note.frontmatter);
  const slug = noteSlug(note.frontmatter);

  let postId = notePostId(note.frontmatter);
  let created = false;

  if (postId === undefined) {
    const choice = await chooseExistingPost(app, api, title);
    if (choice === null) return null;
    if (choice.kind === "post") postId = choice.post.id;
  }

  let saveToken: string;
  let publicSlug: string | null = null;

  if (postId !== undefined) {
    const current = await api.getPost(postId);
    const data: UpdatePostData = {
      title,
      contentMarkdown: body,
      ...(summary !== undefined ? { summary } : {}),
      ...(slug !== undefined ? { slug } : {}),
    };
    const updated = await updateWithRetry(api, postId, data, current.saveToken);
    saveToken = updated.saveToken;
    publicSlug = updated.publicSlug;
  } else {
    const result = await api.createPost({
      title,
      contentMarkdown: body,
      ...(summary !== undefined ? { summary } : {}),
    });
    postId = result.id;
    saveToken = result.saveToken;
    created = true;
  }

  let published = false;
  if (mode === "publish") {
    const result = await publishWithRetry(api, postId, saveToken);
    saveToken = result.saveToken;
    published = true;

    const after = await api.getPost(postId);
    publicSlug = after.publicSlug;
  }

  const postUrl =
    publicSlug !== null
      ? `${api.siteOrigin}/post/${encodeURIComponent(publicSlug)}`
      : null;

  await writeBackMetadata(app, file, postId, postUrl);

  return {
    postId,
    postUrl,
    created,
    published,
    title,
  };
}

async function chooseExistingPost(
  app: App,
  api: BlogApi,
  title: string,
): Promise<PostPickerChoice> {
  const page = await api.listPosts({ search: title, limit: 20 });
  const needle = title.trim().toLocaleLowerCase();
  const matches = page.items.filter(
    (post) => post.title.trim().toLocaleLowerCase() === needle,
  );

  if (matches.length === 0) return { kind: "new" };

  return new Promise<PostPickerChoice>((resolve) => {
    new PostPickerModal(app, matches, resolve).open();
  });
}

async function updateWithRetry(
  api: BlogApi,
  postId: number,
  data: UpdatePostData,
  saveToken: string,
): Promise<AdminPost> {
  try {
    return await api.updatePost(postId, data, saveToken);
  } catch (error) {
    if (!(error instanceof BlogApiError) || !error.isEditConflict) throw error;
    const fresh = await api.getPost(postId);
    return api.updatePost(postId, data, fresh.saveToken);
  }
}

async function publishWithRetry(
  api: BlogApi,
  postId: number,
  saveToken: string,
) {
  try {
    return await api.publishPost(postId, saveToken);
  } catch (error) {
    if (!(error instanceof BlogApiError) || !error.isEditConflict) throw error;
    const fresh = await api.getPost(postId);
    return api.publishPost(postId, fresh.saveToken);
  }
}

async function writeBackMetadata(
  app: App,
  file: TFile,
  postId: number,
  postUrl: string | null,
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    frontmatter.fsb_post_id = postId;
    frontmatter.fsb_updated_at = new Date().toISOString();
    if (postUrl) {
      frontmatter.fsb_url = postUrl;
    }
  });
}

export function postUrlOf(api: BlogApi, post: AdminPost): string | null {
  const slug =
    post.publicSlug ?? (post.status === "published" ? post.slug : null);
  return slug ? `${api.siteOrigin}/post/${encodeURIComponent(slug)}` : null;
}
