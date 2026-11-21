import {
  ButtonComponent,
  Modal,
  Setting,
  TextComponent,
  type App,
} from "obsidian";
import type { BlogApi } from "./api/client";
import { describeApiError } from "./api/errors";
import type { CategoryOption, TagRef } from "./api/types";

export interface TaxonomyValue {
  category: string;
  tags: string[];
}

export class TaxonomyModal extends Modal {
  private category: string;
  private tagsText: string;
  private categories: CategoryOption[] = [];
  private existingTags: TagRef[] = [];
  private readonly categoryListId = `fsb-categories-${Math.random()
    .toString(36)
    .slice(2)}`;
  private categoryInput: HTMLInputElement | null = null;
  private categoryDatalist: HTMLDataListElement | null = null;
  private categoryChipsEl: HTMLElement | null = null;
  private tagInput: HTMLInputElement | null = null;
  private tagChipsEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private tagSearch = "";
  private closed = false;

  constructor(
    app: App,
    private readonly api: BlogApi | null,
    current: TaxonomyValue,
    private readonly onSubmit: (value: TaxonomyValue) => void,
  ) {
    super(app);
    this.category = current.category;
    this.tagsText = current.tags.join(", ");
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-taxonomy-modal");
    this.titleEl.setText("分类和标签");
    this.contentEl.createEl("p", {
      text: "分类只能填一个。云端没有的分类或标签，发布时会自动创建。",
      cls: "fsb-new-post-hint",
    });

    new Setting(this.contentEl)
      .setName("分类")
      .setDesc("单选，可以直接输入新分类")
      .addText((text) => {
        this.categoryInput = text.inputEl;
        text
          .setPlaceholder("不设置")
          .setValue(this.category)
          .onChange((value) => {
            this.category = value;
            this.renderCategoryChips();
          });
        text.inputEl.setAttribute("list", this.categoryListId);
      });

    this.categoryDatalist = this.contentEl.createEl("datalist", {
      attr: { id: this.categoryListId },
    });

    const categoryChipsBox = this.contentEl.createDiv({
      cls: "fsb-taxonomy-tags",
    });
    categoryChipsBox.createEl("div", {
      text: "已有分类",
      cls: "fsb-taxonomy-label",
    });
    this.categoryChipsEl = categoryChipsBox.createDiv({
      cls: "fsb-taxonomy-chips",
    });

    new Setting(this.contentEl)
      .setName("标签")
      .setDesc("逗号分隔")
      .addText((text) => {
        this.tagInput = text.inputEl;
        text
          .setPlaceholder("Obsidian, 博客")
          .setValue(this.tagsText)
          .onChange((value) => {
            this.tagsText = value;
            this.renderTagChips();
          });
      });

    const tagsBox = this.contentEl.createDiv({ cls: "fsb-taxonomy-tags" });
    const search = new TextComponent(tagsBox);
    search.setPlaceholder("搜索已有标签").onChange((value) => {
      this.tagSearch = value;
      this.renderTagChips();
    });
    search.inputEl.addClass("fsb-taxonomy-search");
    this.tagChipsEl = tagsBox.createDiv({ cls: "fsb-taxonomy-chips" });
    this.statusEl = this.contentEl.createDiv({ cls: "fsb-taxonomy-status" });

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    new ButtonComponent(actions)
      .setButtonText("保存")
      .setCta()
      .onClick(() => this.submit());
    new ButtonComponent(actions)
      .setButtonText("取消")
      .onClick(() => this.close());

    void this.load();
  }

  onClose(): void {
    this.closed = true;
    this.contentEl.empty();
  }

  private async load(): Promise<void> {
    if (!this.api) {
      this.statusEl.setText("还没连接博客，先手动输入。");
      this.renderCategoryChips();
      this.renderTagChips();
      return;
    }

    this.statusEl.setText("加载分类和标签…");
    try {
      const [categories, tags] = await Promise.all([
        this.api.listCategoryOptions(),
        this.api.listTags(),
      ]);
      if (this.closed) return;

      this.categories = categories;
      this.existingTags = tags;
      for (const category of categories) {
        this.categoryDatalist?.createEl("option", { value: category.name });
      }
      this.statusEl.setText(
        `已有 ${categories.length} 个分类，${tags.length} 个标签。`,
      );
      this.renderCategoryChips();
      this.renderTagChips();
    } catch (error) {
      if (this.closed) return;
      this.statusEl.setText(
        `读取失败：${describeApiError(error)}，可以先手动输入。`,
      );
      this.renderCategoryChips();
      this.renderTagChips();
    }
  }

  private renderCategoryChips(): void {
    if (!this.categoryChipsEl) return;
    this.categoryChipsEl.empty();

    if (this.categories.length === 0) {
      this.categoryChipsEl.createEl("span", {
        text: this.api ? "云端还没有分类。" : "连上博客后可以选已有分类。",
        cls: "fsb-taxonomy-empty",
      });
      return;
    }

    const current = this.category.trim().toLowerCase();
    for (const category of this.categories) {
      const chip = this.categoryChipsEl.createEl("button", {
        text: category.name,
        cls: "fsb-taxonomy-chip",
      });
      if (category.name.toLowerCase() === current) {
        chip.addClass("is-selected");
      }
      chip.addEventListener("click", () => {
        this.category =
          this.category.trim().toLowerCase() === category.name.toLowerCase()
            ? ""
            : category.name;
        if (this.categoryInput) this.categoryInput.value = this.category;
        this.renderCategoryChips();
      });
    }
  }

  private renderTagChips(): void {
    this.tagChipsEl.empty();
    const selected = new Set(parseTags(this.tagsText).map((tag) => tag.toLowerCase()));
    const needle = this.tagSearch.trim().toLowerCase();
    const tags = this.existingTags.filter(
      (tag) => !needle || tag.name.toLowerCase().includes(needle),
    );

    if (this.existingTags.length === 0) {
      this.tagChipsEl.createEl("span", {
        text: this.api ? "云端还没有标签。" : "连上博客后可以选已有标签。",
        cls: "fsb-taxonomy-empty",
      });
      return;
    }
    if (tags.length === 0) {
      this.tagChipsEl.createEl("span", {
        text: "没有匹配的标签。",
        cls: "fsb-taxonomy-empty",
      });
      return;
    }

    for (const tag of tags) {
      const chip = this.tagChipsEl.createEl("button", {
        text: tag.name,
        cls: "fsb-taxonomy-chip",
      });
      if (selected.has(tag.name.toLowerCase())) chip.addClass("is-selected");
      chip.addEventListener("click", () => {
        const current = parseTags(this.tagsText);
        const lower = tag.name.toLowerCase();
        const exists = current.some((item) => item.toLowerCase() === lower);
        const next = exists
          ? current.filter((item) => item.toLowerCase() !== lower)
          : [...current, tag.name];
        this.tagsText = next.join(", ");
        if (this.tagInput) this.tagInput.value = this.tagsText;
        this.renderTagChips();
      });
    }
  }

  private submit(): void {
    const category = this.category.trim();
    const tags = parseTags(this.tagsText);
    this.close();
    this.onSubmit({ category, tags });
  }
}

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(/[,，]/)) {
    const name = part.trim().replace(/^#/, "");
    if (!name) continue;
    const lower = name.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    tags.push(name);
  }
  return tags;
}
