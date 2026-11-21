export class BlogApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly body: unknown;

  constructor(
    message: string,
    status = 0,
    code?: string,
    body?: unknown,
  ) {
    super(message);
    this.name = "BlogApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }

  get isEditConflict(): boolean {
    return this.status === 409 && this.code === "EDIT_CONFLICT";
  }
}

export function toBlogApiError(error: unknown): BlogApiError {
  if (error instanceof BlogApiError) return error;
  if (error instanceof Error) return new BlogApiError(error.message);
  return new BlogApiError(String(error));
}

export function describeApiError(error: unknown): string {
  const apiError = toBlogApiError(error);
  if (apiError.code === "PUBLISHED_AT_IN_FUTURE") {
    return "发布时间不能晚于现在。";
  }
  const suffix = apiError.status > 0 ? `（HTTP ${apiError.status}）` : "";
  return `${apiError.message}${suffix}`;
}
