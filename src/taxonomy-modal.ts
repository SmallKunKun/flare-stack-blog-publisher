import {
  AbstractInputSuggest,
  ButtonComponent,
  Modal,
  Notice,
  Setting,
  type App,
} from "obsidian";
import type { BlogApi } from "./api/client";
import { describeApiError } from "./api/errors";
import type { CategoryOption, TagRef } from "./api/types";
import { confirmAction } from "./confirm-modal";

export interface TaxonomyValue {
  category: string;
  tags: string[];
}

export class TaxonomyModal extends Modal {
  private category: string;
  private tagsText: string;
  private categories: CategoryOption[] = [];
  private existingTags: TagRef[] = [];
  private categoryInput: HTMLInputElement | null = null;
  private categorySuggest: CategorySuggest | null = null;
  private categoryChipsEl: HTMLElement | null = null;
  private tagInput: HTMLInputElement | null = null;
  private tagChipsEl!: HTMLElement;
  private statusEl!: HTMLElement;
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

    new Setting(this.contentEl)
      .setName("分类")
      .setDesc("单选")
      .addText((text) => {
        this.categoryInput = text.inputEl;
        text
          .setPlaceholder("输入创建新分类")
          .setValue(this.category)
          .onChange((value) => {
            this.category = value;
            this.renderCategoryChips();
          });
        this.categorySuggest = new CategorySuggest(
          this.app,
          text.inputEl,
          () => this.categories,
          (name) => {
            this.category = name;
            if (this.categoryInput) this.categoryInput.value = name;
            this.renderCategoryChips();
          },
        );
        text.inputEl.addEventListener("click", () => {
          const query = text.inputEl.value.trim().toLowerCase();
          const hasMatch = this.categories.some(
            (category) =>
              !query || category.name.toLowerCase().includes(query),
          );
          if (hasMatch) this.categorySuggest?.open();
          else this.categorySuggest?.close();
        });
      });

    const categoryChipsBox = this.contentEl.createDiv({
      cls: "fsb-taxonomy-tags fsb-taxonomy-chip-section",
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

    const tagsBox = this.contentEl.createDiv({
      cls: "fsb-taxonomy-tags fsb-taxonomy-chip-section",
    });
    tagsBox.createEl("div", {
      text: "已有标签",
      cls: "fsb-taxonomy-label",
    });
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
    this.categorySuggest?.close();
    this.categorySuggest = null;
    this.contentEl.empty();
  }

  private async load(): Promise<void> {
    if (!this.api) {
      this.statusEl.setText("还没连接博客，先手动输入");
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
      this.statusEl.setText(
        `已有 ${categories.length} 个分类，${tags.length} 个标签`,
      );
      this.renderCategoryChips();
      this.renderTagChips();
    } catch (error) {
      if (this.closed) return;
      this.statusEl.setText(
        `读取失败：${describeApiError(error)}，可以先手动输入`,
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
        text: this.api ? "云端还没有分类" : "连上博客后可以选已有分类",
        cls: "fsb-taxonomy-empty",
      });
      return;
    }

    const current = this.category.trim().toLowerCase();
    for (const category of this.categories) {
      const wrap = this.categoryChipsEl.createSpan({
        cls: "fsb-taxonomy-chip-wrap",
      });
      const chip = wrap.createEl("button", {
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

      if (this.api) {
        const remove = wrap.createEl("button", {
          text: "×",
          cls: "fsb-taxonomy-chip-delete",
        });
        remove.setAttribute("aria-label", `删除分类 ${category.name}`);
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          void this.deleteCategory(category);
        });
      }
    }
  }

  private async deleteCategory(category: CategoryOption): Promise<void> {
    const confirmed = await confirmAction(this.app, {
      title: "删除分类",
      message:
        `删除「${category.name}」？所有用这个分类的文章都会失去分类，` +
        "分类页面地址也会失效，笔记里如果还留着这个名字，发布或存草稿时可能会重新创建",
      confirmText: "删除分类",
    });
    if (!confirmed || !this.api) return;

    try {
      await this.api.deleteCategory(category.id);
      this.categories = this.categories.filter((item) => item.id !== category.id);
      if (this.category.trim().toLowerCase() === category.name.toLowerCase()) {
        this.category = "";
        if (this.categoryInput) this.categoryInput.value = "";
      }
      this.renderCategoryChips();
      new Notice("分类已删除");
    } catch (error) {
      new Notice(`删除分类失败：${describeApiError(error)}`, 8000);
    }
  }

  private renderTagChips(): void {
    this.tagChipsEl.empty();
    const selected = new Set(parseTags(this.tagsText).map((tag) => tag.toLowerCase()));

    if (this.existingTags.length === 0) {
      this.tagChipsEl.createEl("span", {
        text: this.api ? "云端还没有标签" : "连上博客后可以选已有标签",
        cls: "fsb-taxonomy-empty",
      });
      return;
    }

    for (const tag of this.existingTags) {
      const wrap = this.tagChipsEl.createSpan({
        cls: "fsb-taxonomy-chip-wrap",
      });
      const chip = wrap.createEl("button", {
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

      if (this.api) {
        const remove = wrap.createEl("button", {
          text: "×",
          cls: "fsb-taxonomy-chip-delete",
        });
        remove.setAttribute("aria-label", `删除标签 ${tag.name}`);
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          void this.deleteTag(tag);
        });
      }
    }
  }

  private async deleteTag(tag: TagRef): Promise<void> {
    const confirmed = await confirmAction(this.app, {
      title: "删除标签",
      message:
        `删除「${tag.name}」？所有用这个标签的文章都会失去标签，` +
        "标签页面地址也会失效，笔记里如果还留着这个名字，发布或存草稿时可能会重新创建",
      confirmText: "删除标签",
    });
    if (!confirmed || !this.api) return;

    try {
      await this.api.deleteTag(tag.id);
      this.existingTags = this.existingTags.filter((item) => item.id !== tag.id);
      const remaining = parseTags(this.tagsText).filter(
        (item) => item.toLowerCase() !== tag.name.toLowerCase(),
      );
      this.tagsText = remaining.join(", ");
      if (this.tagInput) this.tagInput.value = this.tagsText;
      this.renderTagChips();
      new Notice("标签已删除");
    } catch (error) {
      new Notice(`删除标签失败：${describeApiError(error)}`, 8000);
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

class CategorySuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private readonly getCategories: () => CategoryOption[],
    private readonly onChoose: (name: string) => void,
  ) {
    super(app, inputEl);
    this.onSelect((value) => {
      this.onChoose(value);
      this.close();
    });
  }

  protected getSuggestions(query: string): string[] {
    const needle = query.trim().toLowerCase();
    return this.getCategories()
      .map((category) => category.name)
      .filter((name) => !needle || name.toLowerCase().includes(needle));
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }
}
