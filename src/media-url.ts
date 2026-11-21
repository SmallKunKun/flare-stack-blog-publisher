export function absoluteMediaUrl(origin: string, url: string): string {
  return url.startsWith("/") ? `${origin}${url}` : url;
}
