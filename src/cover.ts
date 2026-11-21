import { normalizePath, TFile, type App } from "obsidian";

export function coverSource(
  app: App,
  value: string,
  sourcePath: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(?:https?:|data:)/i.test(trimmed)) return trimmed;

  const wiki = trimmed.match(/^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  const target = wiki?.[1]?.trim() ?? trimmed;
  const file =
    app.metadataCache.getFirstLinkpathDest(target, sourcePath) ??
    app.vault.getAbstractFileByPath(normalizePath(target)) ??
    app.vault
      .getFiles()
      .find((item) => item.path === target || item.name === target);

  return file instanceof TFile ? app.vault.getResourcePath(file) : null;
}
