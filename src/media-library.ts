import {
  ButtonComponent,
  MarkdownView,
  Modal,
  Notice,
  TextComponent,
  type App,
} from "obsidian";
import type { BlogApi } from "./api/client";
import { describeApiError } from "./api/errors";
import type { Media } from "./api/types";
import {
  MAX_IMAGE_BYTES,
  imageMimeType,
  uploadImageBytes,
} from "./media";
import { absoluteMediaUrl } from "./media-url";
import { formatBeijingTime } from "./time";

const PAGE_SIZE = 60;

export interface MediaLibraryOptions {
  selectMode?: boolean;
  onChoose?: (media: Media) => void;
}

export class MediaLibraryModal extends Modal {
  private query = "";
  private cursor: number | null = null;
  private requestId = 0;
  private timer: number | null = null;
  private count = 0;
  private closed = false;
  private gridEl!: HTMLElement;
  private columns: HTMLElement[] = [];
  private columnHeights: number[] = [];
  private statusEl!: HTMLElement;
  private moreEl!: HTMLElement;
  private searchInput: TextComponent | null = null;
  private uploadButton: ButtonComponent | null = null;

  constructor(
    app: App,
    private readonly api: BlogApi,
    private readonly renameToUuid: boolean,
    private readonly options: MediaLibraryOptions = {},
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-media-modal");
    this.titleEl.setText(this.options.selectMode ? "选择封面" : "媒体库");

    const toolbar = this.contentEl.createDiv({ cls: "fsb-media-toolbar" });
    this.searchInput = new TextComponent(toolbar);
    this.searchInput
      .setPlaceholder("搜索文件名…")
      .onChange((value) => {
        this.query = value;
        if (this.timer !== null) window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => void this.load(true), 250);
      });
    this.searchInput.inputEl.addClass("fsb-media-search");

    if (!this.options.selectMode) {
      this.uploadButton = new ButtonComponent(toolbar)
        .setButtonText("上传本地图片")
        .onClick(() => this.pickLocalImage());
    }

    this.statusEl = this.contentEl.createDiv({ cls: "fsb-media-status" });
    this.gridEl = this.contentEl.createDiv({ cls: "fsb-media-grid" });
    this.moreEl = this.contentEl.createDiv({ cls: "fsb-media-more" });

    void this.load(true);
  }

  onClose(): void {
    this.closed = true;
    this.requestId += 1;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.contentEl.empty();
  }

  private async load(reset: boolean): Promise<void> {
    const requestId = ++this.requestId;
    if (reset) {
      this.cursor = null;
      this.count = 0;
      this.gridEl.empty();
      this.columns = [];
      this.columnHeights = [];
    }

    this.statusEl.setText("加载中…");

    try {
      const page = await this.api.listMedia({
        search: this.query.trim() || undefined,
        limit: PAGE_SIZE,
        cursor: this.cursor ?? undefined,
        sort: "newest",
      });
      if (requestId !== this.requestId) return;

      this.count += page.items.length;
      this.render(page.items);
      this.cursor = page.nextCursor;
      this.statusEl.setText(
        this.count === 0 ? "未找到图片" : `已加载 ${this.count} 张`,
      );
      this.renderMore();
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.statusEl.setText(`加载失败：${describeApiError(error)}`);
    }
  }

  private render(items: Media[]): void {
    this.ensureColumns();
    for (const media of items) {
      const index = this.shortestColumn();
      this.renderCard(this.columns[index], media);
      this.columnHeights[index] += this.estimateCardHeight(media) + 10;
    }
  }

  private layoutWidth(): number {
    return (
      this.gridEl.clientWidth ||
      Math.min(860, window.innerWidth * 0.9)
    );
  }

  private ensureColumns(): void {
    if (this.columns.length > 0) return;

    const width = this.layoutWidth();
    const count = Math.max(1, Math.floor((width + 10) / 190));
    for (let index = 0; index < count; index += 1) {
      this.columns.push(
        this.gridEl.createDiv({ cls: "fsb-media-column" }),
      );
      this.columnHeights.push(0);
    }
  }

  private shortestColumn(): number {
    let shortest = 0;
    for (let index = 1; index < this.columnHeights.length; index += 1) {
      if (this.columnHeights[index] < this.columnHeights[shortest]) {
        shortest = index;
      }
    }
    return shortest;
  }

  private estimateCardHeight(media: Media): number {
    const count = this.columns.length || 1;
    const width = this.layoutWidth();
    const columnWidth = Math.max(120, (width - 10 * (count - 1)) / count);
    const ratio =
      media.width && media.height ? media.height / media.width : 0.75;
    return columnWidth * ratio + 76;
  }

  private renderCard(column: HTMLElement, media: Media): void {
    const url = absoluteMediaUrl(this.api.siteOrigin, media.url);
    const card = column.createDiv({ cls: "fsb-media-card" });
    const thumb = card.createDiv({ cls: "fsb-media-thumb" });
    const image = thumb.createEl("img", {
      attr: {
        src: url,
        alt: media.fileName,
        loading: "lazy",
      },
    });
    image.addEventListener("error", () => {
      thumb.empty();
      thumb.createDiv({
        text: "图片加载失败",
        cls: "fsb-media-thumb-empty",
      });
    });

    card.createDiv({
      text: media.fileName,
      cls: "fsb-media-name",
      attr: { title: media.fileName },
    });
    card.createDiv({
      text: `${formatBytes(media.sizeInBytes)} · ${formatBeijingTime(media.createdAt)}`,
      cls: "fsb-media-meta",
    });

    const actions = card.createDiv({ cls: "fsb-media-actions" });
    if (this.options.selectMode) {
      actions
        .createEl("button", { text: "选择", cls: "fsb-media-action" })
        .addEventListener("click", () => this.choose(media));
    } else {
      actions
        .createEl("button", { text: "插入", cls: "fsb-media-action" })
        .addEventListener("click", () => this.insert(media));
      actions
        .createEl("button", { text: "复制链接", cls: "fsb-media-action" })
        .addEventListener("click", () => void this.copy(media));
    }
  }

  private choose(media: Media): void {
    this.options.onChoose?.(media);
    this.close();
  }

  private renderMore(): void {
    this.moreEl.empty();
    if (this.cursor === null) return;
    const button = new ButtonComponent(this.moreEl)
      .setButtonText("加载更多")
      .onClick(() => void this.load(false));
    button.buttonEl.addClass("fsb-media-more-button");
  }

  private pickLocalImage(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (file) void this.upload(file);
    });
    input.addEventListener("cancel", () => input.remove());
    document.body.appendChild(input);
    input.click();
  }

  private async upload(file: File): Promise<void> {
    const mimeType = imageMimeType(file.name);
    if (!mimeType) {
      new Notice("不支持的图片格式");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      new Notice("图片超过 10 MB");
      return;
    }

    this.uploadButton?.setDisabled(true);
    new Notice(`正在上传：${file.name}`);

    try {
      const bytes = await file.arrayBuffer();
      const media = await uploadImageBytes(
        this.api,
        file.name,
        mimeType,
        bytes,
        { renameToUuid: this.renameToUuid },
      );
      new Notice(`已上传：${media.fileName}`);

      if (this.closed) return;
      this.query = "";
      this.searchInput?.setValue("");
      await this.load(true);
    } catch (error) {
      new Notice(`上传失败：${describeApiError(error)}`, 8000);
    } finally {
      this.uploadButton?.setDisabled(false);
    }
  }

  private insert(media: Media): void {
    const url = absoluteMediaUrl(this.api.siteOrigin, media.url);
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      void this.copy(media);
      return;
    }

    const alt = media.fileName.replace(/\.[^.]+$/, "").replace(/[\[\]]/g, "");
    view.editor.replaceSelection(`![${alt}](${url})`);
    this.close();
    new Notice("已插入图片");
  }

  private async copy(media: Media): Promise<void> {
    const url = absoluteMediaUrl(this.api.siteOrigin, media.url);
    if (await copyText(url)) {
      new Notice("链接已复制");
    } else {
      new Notice("复制链接失败");
    }
  }
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the textarea method below.
    }
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
