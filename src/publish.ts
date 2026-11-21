import type { App, TFile } from "obsidian";
import type { BlogApi } from "./api/client";
import { BlogApiError } from "./api/errors";
import type {
  AdminPost,
  SetTagsResult,
  UpdatePostData,
} from "./api/types";
import type { PublisherSettings } from "./settings";
import {
  hasCategoryField,
  hasTagField,
  noteCategory,
  notePostId,
  notePublishedAt,
  noteSlug,
  noteSummary,
  noteTags,
  noteTitle,
  parseNote,
  stringList,
} from "./note";
import { PostPickerModal, type PostPickerChoice } from "./post-picker";
import { categoryIdFor, resolveTaxonomy } from "./taxonomy";
import { uploadBodyImages, uploadCover } from "./media";
import { convertWikiLinks } from "./links";
import { migrateProperties } from "./properties";
import { beijingIsoNow } from "./time";

export type PublishMode = "publish" | "draft";

export interface PublishOutcome {
  postId: number;
  postUrl: string | null;
  created: boolean;
  published: boolean;
  title: string;
  warnings: string[];
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
  const { app, api, settings } = context;
  const raw = await app.vault.read(file);
  const note = parseNote(raw);
  const title = noteTitle(note.frontmatter, file.basename);

  if (!title) {
    throw new Error("标题是空的。");
  }

  const body = note.body;
  const summary = noteSummary(note.frontmatter);
  const slug = noteSlug(note.frontmatter);
  const publishedAt = notePublishedAt(note.frontmatter);

  let postId = notePostId(note.frontmatter);
  if (postId === undefined) {
    const choice = await chooseExistingPost(app, api, title);
    if (choice === null) return null;
    if (choice.kind === "post") postId = choice.post.id;
  }

  const created = postId === undefined;
  const warnings: string[] = [];

  let publishBody = body;
  const mediaOptions = { renameToUuid: settings.uuidImageNames };
  if (settings.uploadLocalImages) {
    const uploaded = await uploadBodyImages(
      app,
      api,
      body,
      file.path,
      mediaOptions,
    );
    publishBody = uploaded.body;
    warnings.push(...uploaded.warnings);
  }

  if (settings.convertWikiLinks) {
    const converted = await convertWikiLinks(app, api, publishBody, file.path);
    publishBody = converted.body;
    warnings.push(...converted.warnings);
  }

  const cover = settings.uploadLocalImages
    ? await uploadCover(app, api, note.frontmatter, file.path, mediaOptions)
    : { mediaId: undefined, warnings: [] };
  warnings.push(...cover.warnings);
  const defaultTags = stringList(settings.defaultTags);
  const categoryName = hasCategoryField(note.frontmatter)
    ? (noteCategory(note.frontmatter) ?? "")
    : created && settings.defaultCategory.trim()
      ? settings.defaultCategory.trim()
      : undefined;
  const syncTags =
    hasTagField(note.frontmatter) || (created && defaultTags.length > 0);
  const tagNames = hasTagField(note.frontmatter)
    ? noteTags(note.frontmatter)
    : defaultTags;

  const taxonomy = await resolveTaxonomy(api, {
    categoryName,
    syncTags,
    tagNames,
    autoCreate: settings.autoCreateTaxonomy,
  });

  let saveToken: string;
  let publicSlug: string | null = null;
  let isNew = false;

  if (postId !== undefined) {
    const current = await api.getPost(postId);
    const data: UpdatePostData = {
      title,
      contentMarkdown: publishBody,
      ...(summary !== undefined ? { summary } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    };
    const categoryId = categoryIdFor(taxonomy.category);
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (cover.mediaId !== undefined) data.coverMediaId = cover.mediaId;

    const updated = await updateWithRetry(api, postId, data, current.saveToken);
    saveToken = updated.saveToken;
    publicSlug = updated.publicSlug;
  } else {
    const result = await api.createPost({
      title,
      contentMarkdown: publishBody,
      ...(summary !== undefined ? { summary } : {}),
    });
    postId = result.id;
    saveToken = result.saveToken;
    isNew = true;

    // Keep the id even if a later step fails, so a retry updates this draft
    // instead of creating a duplicate.
    await writeBackMetadata(app, file, postId, null);

    const patch: UpdatePostData = {};
    const categoryId = categoryIdFor(taxonomy.category);
    if (categoryId !== undefined) patch.categoryId = categoryId;
    if (cover.mediaId !== undefined) patch.coverMediaId = cover.mediaId;
    if (slug !== undefined) patch.slug = slug;
    if (publishedAt) patch.publishedAt = publishedAt;

    if (Object.keys(patch).length > 0) {
      const patched = await updateWithRetry(api, postId, patch, saveToken);
      saveToken = patched.saveToken;
    }
  }

  if (taxonomy.tagIds !== undefined) {
    const tagged = await setTagsWithRetry(
      api,
      postId,
      taxonomy.tagIds,
      saveToken,
    );
    saveToken = tagged.saveToken;
  }

  let published = false;
  if (mode === "publish") {
    const result = await publishWithRetry(api, postId, saveToken);
    saveToken = result.saveToken;
    published = true;

    try {
      const after = await api.getPost(postId);
      publicSlug = after.publicSlug;
    } catch {
      // Publishing already succeeded; a failed read should not turn it into a
      // reported failure. Fall back to the slug this save stated.
      if (slug !== undefined) publicSlug = slug;
    }
  }

  const postUrl =
    publicSlug !== null
      ? `${api.siteOrigin}/post/${encodeURIComponent(publicSlug)}`
      : null;

  await writeBackMetadata(app, file, postId, postUrl);

  return {
    postId,
    postUrl,
    created: isNew,
    published,
    title,
    warnings: [...taxonomy.warnings, ...warnings],
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

async function setTagsWithRetry(
  api: BlogApi,
  postId: number,
  tagIds: number[],
  saveToken: string,
): Promise<SetTagsResult> {
  try {
    return await api.setPostTags(postId, tagIds, saveToken);
  } catch (error) {
    if (!(error instanceof BlogApiError) || !error.isEditConflict) throw error;
    const fresh = await api.getPost(postId);
    return api.setPostTags(postId, tagIds, fresh.saveToken);
  }
}

async function writeBackMetadata(
  app: App,
  file: TFile,
  postId: number,
  postUrl: string | null,
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    migrateProperties(frontmatter);
    frontmatter.fsb_post_id = postId;
    frontmatter.fsb_updated_at = beijingIsoNow();
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
