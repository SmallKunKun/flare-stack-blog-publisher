import {
  ButtonComponent,
  MarkdownView,
  Modal,
  Notice,
  TextComponent,
  TFile,
  type App,
} from "obsidian";
import type { BlogApi } from "./api/client";
import { describeApiError } from "./api/errors";
import type { Media } from "./api/types";
import { ImagePickerModal } from "./image-picker";
import { uploadVaultImage } from "./media";
import { formatBeijingTime } from "./time";

const PAGE_SIZE = 60;

export class MediaLibraryModal extends Modal {
  private query = "";
  private cursor: number | null = null;
  private requestId = 0;
  private timer: number | null = null;
  private count = 0;
  private closed = false;
  private gridEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private moreEl!: HTMLElement;
  private searchInput: TextComponent | null = null;
  private uploadButton: ButtonComponent | null = null;

  constructor(
    app: App,
    private readonly api: BlogApi,
    private readonly renameToUuid: boolean,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-media-modal");
    this.titleEl.setText("媒体库");

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

    this.uploadButton = new ButtonComponent(toolbar)
      .setButtonText("上传本地图片")
      .onClick(() => this.pickLocalImage());

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
        this.count === 0 ? "没有找到图片" : `已加载 ${this.count} 张`,
      );
      this.renderMore();
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.statusEl.setText(`加载失败：${describeApiError(error)}`);
    }
  }

  private render(items: Media[]): void {
    for (const media of items) this.renderItem(media);
  }

  private renderItem(media: Media): void {
    const url = absoluteMediaUrl(this.api.siteOrigin, media.url);
    const card = this.gridEl.createDiv({ cls: "fsb-media-card" });
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
    actions
      .createEl("button", { text: "插入", cls: "fsb-media-action" })
      .addEventListener("click", () => this.insert(media));
    actions
      .createEl("button", { text: "复制链接", cls: "fsb-media-action" })
      .addEventListener("click", () => void this.copy(media));
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
    new ImagePickerModal(this.app, (file) => {
      void this.upload(file);
    }).open();
  }

  private async upload(file: TFile): Promise<void> {
    this.uploadButton?.setDisabled(true);
    new Notice(`正在上传 ${file.name}…`);

    try {
      const media = await uploadVaultImage(this.api, file, {
        renameToUuid: this.renameToUuid,
      });
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
    try {
      await navigator.clipboard.writeText(url);
      new Notice("链接已复制");
    } catch {
      new Notice("复制失败");
    }
  }
}

function absoluteMediaUrl(origin: string, url: string): string {
  return url.startsWith("/") ? `${origin}${url}` : url;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
