import { requestUrl, type RequestUrlParam } from "obsidian";
import { BlogApiError } from "./errors";
import type {
  AdminPost,
  AdminPostListPage,
  ApiErrorPayload,
  CategoryOption,
  CreatePostData,
  CreatePostResult,
  DeleteResult,
  Media,
  MediaListPage,
  SetTagsResult,
  TagRef,
  UpdatePostData,
  WriteResult,
} from "./types";

/**
 * A browser User-Agent is required because a blog may sit behind a WAF that
 * refuses non-browser clients with Cloudflare error 1010.
 */
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface BlogApiOptions {
  siteUrl: string;
  apiKey: string;
}

export interface ListPostsParams {
  search?: string;
  limit?: number;
  offset?: number;
  status?: "draft" | "published";
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  bodyBytes?: ArrayBuffer;
  contentType?: string;
}

export class BlogApi {
  private readonly origin: string;
  private readonly apiKey: string;

  constructor(options: BlogApiOptions) {
    this.origin = normalizeSiteUrl(options.siteUrl);
    this.apiKey = options.apiKey.trim();
  }

  get siteOrigin(): string {
    return this.origin;
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async listPosts(params: ListPostsParams = {}): Promise<AdminPostListPage> {
    return this.request<AdminPostListPage>("GET", "/admin/posts", {
      query: {
        search: params.search,
        limit: params.limit,
        offset: params.offset,
        status: params.status,
      },
    });
  }

  async getPost(id: number): Promise<AdminPost> {
    return this.request<AdminPost>("GET", `/admin/posts/${id}`, {
      query: { contentFormat: "markdown" },
    });
  }

  async createPost(data: CreatePostData): Promise<CreatePostResult> {
    return this.request<CreatePostResult>("POST", "/admin/posts", {
      body: { data },
    });
  }

  async updatePost(
    id: number,
    data: UpdatePostData,
    saveToken: string,
  ): Promise<AdminPost> {
    return this.request<AdminPost>("PATCH", `/admin/posts/${id}`, {
      body: { data, saveToken, contentFormat: "markdown" },
    });
  }

  async publishPost(id: number, saveToken: string): Promise<WriteResult> {
    return this.request<WriteResult>("POST", `/admin/posts/${id}/publish`, {
      body: { saveToken },
    });
  }

  async unpublishPost(id: number): Promise<WriteResult> {
    return this.request<WriteResult>("POST", `/admin/posts/${id}/unpublish`);
  }

  async deletePost(id: number): Promise<DeleteResult> {
    return this.request<DeleteResult>("DELETE", `/admin/posts/${id}`);
  }

  async setPostTags(
    postId: number,
    tagIds: number[],
    saveToken: string,
  ): Promise<SetTagsResult> {
    return this.request<SetTagsResult>(
      "PUT",
      `/admin/posts/${postId}/tags`,
      { body: { tagIds, saveToken } },
    );
  }

  async listTags(): Promise<TagRef[]> {
    return this.request<TagRef[]>("GET", "/admin/tags");
  }

  async createTag(name: string): Promise<TagRef> {
    return this.request<TagRef>("POST", "/admin/tags", { body: { name } });
  }

  async deleteTag(id: number): Promise<DeleteResult> {
    return this.request<DeleteResult>("DELETE", `/admin/tags/${id}`);
  }

  async listCategoryOptions(): Promise<CategoryOption[]> {
    return this.request<CategoryOption[]>("GET", "/admin/categories/options");
  }

  async listMedia(params: {
    search?: string;
    limit?: number;
    cursor?: number;
    sort?: "newest" | "oldest" | "largest";
  } = {}): Promise<MediaListPage> {
    return this.request<MediaListPage>("GET", "/admin/media", {
      query: {
        search: params.search,
        limit: params.limit,
        cursor: params.cursor,
        sort: params.sort,
      },
    });
  }
  async createCategory(name: string): Promise<CategoryOption> {
    return this.request<CategoryOption>("POST", "/admin/categories", {
      body: { name },
    });
  }

  async deleteCategory(id: number): Promise<DeleteResult> {
    return this.request<DeleteResult>("DELETE", `/admin/categories/${id}`);
  }

  async uploadMedia(
    fileName: string,
    mimeType: string,
    bytes: ArrayBuffer,
  ): Promise<Media> {
    const boundary = `----FlareStackBlogPublisher${Date.now().toString(16)}`;
    const head = new TextEncoder().encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="image"; filename="${escapeFileName(fileName)}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
    );
    const tail = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
    const body = concatBytes(head, new Uint8Array(bytes), tail);
    return this.request<Media>("POST", "/admin/media", {
      bodyBytes: arrayBufferOf(body),
      contentType: `multipart/form-data; boundary=${boundary}`,
    });
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": BROWSER_USER_AGENT,
    };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    let body: string | ArrayBuffer | undefined;
    if (options.bodyBytes) {
      body = options.bodyBytes;
    } else if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers["Content-Type"] = "application/json";
    }

    const request: RequestUrlParam = {
      url,
      method,
      headers,
      body,
      contentType: options.contentType,
      throw: false,
    };

    let response;
    try {
      response = await requestUrl(request);
    } catch (error) {
      throw new BlogApiError(
        networkErrorMessage(error),
        0,
        undefined,
        error,
      );
    }

    const payload = parsePayload(response.text);
    if (response.status < 200 || response.status >= 300) {
      const apiError = payload as ApiErrorPayload | undefined;
      throw new BlogApiError(
        apiError?.message ?? `请求失败：HTTP ${response.status}`,
        response.status,
        apiError?.code,
        payload,
      );
    }
    return payload as T;
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`/api${path}`, this.origin);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}

export function normalizeSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BlogApiError("还没填博客地址");
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new BlogApiError(`博客地址不对：${input}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlogApiError("博客地址要以 http:// 或 https:// 开头");
  }
  return url.origin;
}

function parsePayload(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function networkErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `连不上博客，检查地址、网络和 API Key${detail ? `（${detail}）` : ""}`;
}

function escapeFileName(fileName: string): string {
  return fileName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
