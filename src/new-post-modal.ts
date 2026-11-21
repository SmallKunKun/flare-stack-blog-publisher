import {
  ButtonComponent,
  Modal,
  Notice,
  Setting,
  type App,
} from "obsidian";
import type { BlogApi } from "./api/client";
import type { NewPostForm } from "./create-post";
import { coverSource } from "./cover";
import { ImagePickerModal } from "./image-picker";
import { MediaLibraryModal } from "./media-library";
import { absoluteMediaUrl } from "./media-url";
import { TaxonomyModal } from "./taxonomy-modal";
import {
  beijingDateTimeLocalValue,
  beijingInputToIso,
} from "./time";

export interface NewPostModalOptions {
  mode?: "create" | "edit";
  initial?: NewPostForm;
  sourcePath?: string;
}

export class NewPostModal extends Modal {
  private title = "";
  private summary = "";
  private category = "";
  private tags: string[] = [];
  private slug = "";
  private cover = "";
  private coverMediaId: number | undefined;
  private publishedAt: string;
  private titleInput: HTMLInputElement | null = null;
  private taxonomySetting: Setting | null = null;
  private coverSetting: Setting | null = null;
  private coverPreviewEl: HTMLDivElement | null = null;
  private clearCoverButton: ButtonComponent | null = null;
  private readonly mode: "create" | "edit";
  private readonly sourcePath: string;

  constructor(
    app: App,
    private readonly api: BlogApi | null,
    autoFillPublishedAt: boolean,
    private readonly onSubmit: (form: NewPostForm) => void,
    options: NewPostModalOptions = {},
  ) {
    super(app);
    this.mode = options.mode ?? "create";
    this.sourcePath = options.sourcePath ?? "";
    const initial = options.initial;

    if (initial) {
      this.title = initial.title;
      this.summary = initial.summary;
      this.category = initial.category;
      this.tags = [...initial.tags];
      this.slug = initial.slug;
      this.cover = initial.cover;
      this.coverMediaId = initial.coverMediaId;
      const date = initial.publishedAt ? new Date(initial.publishedAt) : null;
      this.publishedAt =
        date && !Number.isNaN(date.getTime())
          ? beijingDateTimeLocalValue(date)
          : "";
    } else {
      this.publishedAt = autoFillPublishedAt
        ? beijingDateTimeLocalValue()
        : "";
    }
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-new-post-modal");
    this.titleEl.setText(this.mode === "edit" ? "文章信息" : "新建文章");

    new Setting(this.contentEl)
      .setName("标题")
      .setDesc("必填")
      .addText((text) => {
        this.titleInput = text.inputEl;
        text
          .setValue(this.title)
          .setPlaceholder("文章标题")
          .onChange((value) => {
            this.title = value;
          });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            this.submit();
          }
        });
      });

    this.coverSetting = new Setting(this.contentEl)
      .setName("封面")
      .setDesc(this.coverSummary())
      .addButton((button) =>
        button.setButtonText("选择图片…").onClick(() => this.pickCover()),
      )
      .addButton((button) =>
        button
          .setButtonText("媒体库")
          .onClick(() => this.pickCoverFromLibrary()),
      )
      .addButton((button) => {
        this.clearCoverButton = button;
        button
          .setButtonText("清除")
          .setDisabled(!this.cover)
          .onClick(() => {
            this.cover = "";
            this.coverMediaId = undefined;
            this.updateCover();
          });
      });

    this.coverPreviewEl = this.contentEl.createDiv({
      cls: "fsb-cover-preview",
    });
    this.renderCoverPreview();

    this.taxonomySetting = new Setting(this.contentEl)
      .setName("分类和标签")
      .setDesc(this.taxonomySummary())
      .addButton((button) =>
        button.setButtonText("选择…").onClick(() => this.pickTaxonomy()),
      );

    new Setting(this.contentEl)
      .setName("链接")
      .setDesc("留空自动生成")
      .addText((text) =>
        text
          .setValue(this.slug)
          .setPlaceholder("文章链接")
          .onChange((value) => {
            this.slug = value;
          }),
      );

    new Setting(this.contentEl)
      .setName("日期")
      .setDesc("留空自动生成")
      .addText((text) => {
        text.inputEl.type = "datetime-local";
        text.setValue(this.publishedAt).onChange((value) => {
          this.publishedAt = value;
        });
      });

    const summarySetting = new Setting(this.contentEl)
      .setName("摘要")
      .setDesc("选填")
      .addTextArea((text) => {
        text
          .setValue(this.summary)
          .setPlaceholder("文章摘要")
          .onChange((value) => {
            this.summary = value;
          });
        text.inputEl.rows = 4;
        text.inputEl.addClass("fsb-summary-input");
      });
    summarySetting.settingEl.addClass("fsb-summary-setting");

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    new ButtonComponent(actions)
      .setButtonText(this.mode === "edit" ? "保存" : "创建并打开")
      .setCta()
      .onClick(() => this.submit());
    new ButtonComponent(actions)
      .setButtonText("取消")
      .onClick(() => this.close());

    window.setTimeout(() => this.titleInput?.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private taxonomySummary(): DocumentFragment {
    const category = this.category.trim() || "无";
    const tags = this.tags.length > 0 ? this.tags.join("、") : "无";
    const fragment = document.createDocumentFragment();
    const categoryLine = document.createElement("div");
    categoryLine.textContent = `分类：${category}`;
    const tagsLine = document.createElement("div");
    tagsLine.textContent = `标签：${tags}`;
    fragment.append(categoryLine, tagsLine);
    return fragment;
  }

  private pickTaxonomy(): void {
    new TaxonomyModal(
      this.app,
      this.api,
      { category: this.category, tags: this.tags },
      (value) => {
        this.category = value.category;
        this.tags = value.tags;
        this.taxonomySetting?.setDesc(this.taxonomySummary());
      },
    ).open();
  }

  private coverSummary(): string {
    return this.cover || "未选择";
  }

  private updateCover(): void {
    this.coverSetting?.setDesc(this.coverSummary());
    this.clearCoverButton?.setDisabled(!this.cover);
    this.renderCoverPreview();
  }

  private pickCover(): void {
    new ImagePickerModal(this.app, (file) => {
      this.cover = file.path;
      this.coverMediaId = undefined;
      this.updateCover();
    }).open();
  }

  private pickCoverFromLibrary(): void {
    if (!this.api) {
      new Notice("请先配置博客地址和 API Key");
      return;
    }

    const api = this.api;
    new MediaLibraryModal(this.app, api, false, {
      selectMode: true,
      onChoose: (media) => {
        this.cover = absoluteMediaUrl(api.siteOrigin, media.url);
        this.coverMediaId = media.id;
        this.updateCover();
      },
    }).open();
  }

  private renderCoverPreview(): void {
    if (!this.coverPreviewEl) return;
    this.coverPreviewEl.empty();

    if (!this.cover) {
      this.coverPreviewEl.createDiv({
        text: "未设置封面",
        cls: "fsb-cover-preview-empty",
      });
      return;
    }

    const source = coverSource(this.app, this.cover, this.sourcePath);
    if (!source) {
      this.coverPreviewEl.createDiv({
        text: "未找到封面图片",
        cls: "fsb-cover-preview-empty",
      });
      return;
    }

    const image = this.coverPreviewEl.createEl("img", {
      attr: { src: source, alt: "封面预览" },
    });
    image.addEventListener("error", () => {
      if (!this.coverPreviewEl) return;
      this.coverPreviewEl.empty();
      this.coverPreviewEl.createDiv({
        text: "图片加载失败",
        cls: "fsb-cover-preview-empty",
      });
    });
  }

  private submit(): void {
    const title = this.title.trim();
    if (!title) {
      new Notice("标题不能为空");
      this.titleInput?.focus();
      return;
    }

    const form: NewPostForm = {
      title,
      summary: this.summary,
      category: this.category,
      tags: this.tags,
      slug: this.slug,
      cover: this.cover,
      coverMediaId: this.coverMediaId,
      publishedAt: beijingInputToIso(this.publishedAt) ?? "",
    };
    this.close();
    this.onSubmit(form);
  }
}
