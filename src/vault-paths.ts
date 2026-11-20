import { normalizePath, TFile, type App } from "obsidian";

export function normalizeFolder(value: string, fallback: string): string {
  const parts = (value || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== "." && part !== "..");
  return parts.length > 0 ? parts.join("/") : fallback;
}

export function safeName(value: string, fallback: string): string {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|#^\[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

export function uniqueChildFolder(
  app: App,
  parent: string,
  name: string,
): string {
  let index = 1;
  let candidate = normalizePath(`${parent}/${name}`);
  while (app.vault.getAbstractFileByPath(candidate)) {
    index += 1;
    candidate = normalizePath(`${parent}/${name}-${index}`);
  }
  return candidate;
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
  if (!folder) return;
  let current = "";
  for (const part of folder.split("/")) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (existing instanceof TFile) {
      throw new Error(`路径被同名文件占用：${current}`);
    }
    if (!existing) await app.vault.createFolder(current);
  }
}

export async function writeNote(
  app: App,
  path: string,
  content: string,
): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }
  if (existing) throw new Error(`路径被文件夹占用：${path}`);
  return app.vault.create(path, content);
}

export function parentFolder(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}
