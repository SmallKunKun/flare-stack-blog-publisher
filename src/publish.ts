import type { App, TFile } from "obsidian";
import type { BlogApi } from "./api/client";
import type {
  AdminPost,
  UpdatePostData,
} from "./api/types";
import type { PublisherSettings } from "./settings";
import {
  notePostId,
  noteSlug,
  noteSummary,
  noteTitle,
  parseNote,
} from "./note";

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
): Promise<PublishOutcome> {
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
  const existingId = notePostId(note.frontmatter);

  let postId: number;
  let saveToken: string;
  let created = false;
  let publicSlug: string | null = null;

  if (existingId !== undefined) {
    const current = await api.getPost(existingId);
    const data: UpdatePostData = {
      title,
      contentMarkdown: body,
      ...(summary !== undefined ? { summary } : {}),
      ...(slug !== undefined ? { slug } : {}),
    };
    const updated = await api.updatePost(existingId, data, current.saveToken);
    postId = updated.id;
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
    const result = await api.publishPost(postId, saveToken);
    saveToken = result.saveToken;
    published = true;

    const after = await api.getPost(postId);
    publicSlug = after.publicSlug;
    saveToken = after.saveToken;
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
  const slug = post.publicSlug ?? (post.status === "published" ? post.slug : null);
  return slug ? `${api.siteOrigin}/post/${encodeURIComponent(slug)}` : null;
}
