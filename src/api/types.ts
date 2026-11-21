export type PostStatus = "draft" | "published";

export interface CategoryRef {
  id: number;
  name: string;
}

export interface TagRef {
  id: number;
  name: string;
  createdAt?: string;
}

export interface AdminPostListItem {
  id: number;
  title: string;
  summary: string | null;
  slug: string;
  publicSlug: string | null;
  status: PostStatus;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: CategoryRef | null;
  tags: TagRef[];
}

export interface AdminPostListPage {
  items: AdminPostListItem[];
  total: number;
}

export interface PublishedVersion {
  title: string;
  summary: string | null;
  slug: string;
  publishedAt: string;
  categoryId: number | null;
  tagIds: number[];
}

export interface AdminPost {
  id: number;
  title: string;
  summary: string | null;
  slug: string;
  publicSlug: string | null;
  status: PostStatus;
  contentMarkdown?: string | null;
  publicSnapshotContentMarkdown?: string | null;
  saveToken: string;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryId: number | null;
  tags?: TagRef[];
  published: PublishedVersion | null;
}

export interface CreatePostData {
  title: string;
  summary?: string | null;
  contentMarkdown: string;
}

export interface UpdatePostData {
  title?: string;
  summary?: string | null;
  slug?: string;
  contentMarkdown?: string;
  categoryId?: number | null;
  coverMediaId?: number | null;
  publishedAt?: string | null;
}

export interface CreatePostResult {
  id: number;
  saveToken: string;
}

export interface DeleteResult {
  success: boolean;
}

export interface WriteResult {
  success: boolean;
  saveToken: string;
}

export interface SetTagsResult {
  saveToken: string;
}

export interface Media {
  id: number;
  key: string;
  url: string;
  fileName: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  sizeInBytes: number;
  createdAt: string;
}

export interface MediaListPage {
  items: Media[];
  nextCursor: number | null;
}

export interface CategoryOption {
  id: number;
  name: string;
}

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  data?: unknown;
}
