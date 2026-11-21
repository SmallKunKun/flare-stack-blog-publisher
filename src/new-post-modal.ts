import {
  ButtonComponent,
  Modal,
  Notice,
  Setting,
  type App,
} from "obsidian";
import type { BlogApi } from "./api/client";
import type { NewPostForm } from "./create-post";
import { TaxonomyModal } from "./taxonomy-modal";
import {
  beijingDateTimeLocalValue,
  beijingInputToIso,
} from "./time";

export class NewPostModal extends Modal {
  private title = "";
  private summary = "";
  private category = "";
  private tags: string[] = [];
  private slug = "";
  private cover = "";
  private publishedAt: string;
  private titleInput: HTMLInputElement | null = null;
  private taxonomySetting: Setting | null = null;

  constructor(
    app: App,
    private readonly api: BlogApi | null,
    autoFillPublishedAt: boolean,
    defaultCategory: string,
    defaultTags: string[],
    private readonly onSubmit: (form: NewPostForm) => void,
  ) {
    super(app);
    this.category = defaultCategory.trim();
    this.tags = [...defaultTags];
    this.publishedAt = autoFillPublishedAt
      ? beijingDateTimeLocalValue()
      : "";
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-new-post-modal");
    this.titleEl.setText("新建文章");
    this.contentEl.createEl("p", {
      text: "属性会写进 frontmatter，建好直接写正文。",
      cls: "fsb-new-post-hint",
    });

    new Setting(this.contentEl)
      .setName("标题")
      .setDesc("必填")
      .addText((text) => {
        this.titleInput = text.inputEl;
        text.setPlaceholder("文章标题").onChange((value) => {
          this.title = value;
        });
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            this.submit();
          }
        });
      });

    new Setting(this.contentEl).setName("摘要").addText((text) =>
      text
        .setPlaceholder("选填，显示在列表和搜索里")
        .onChange((value) => {
          this.summary = value;
        }),
    );

    this.taxonomySetting = new Setting(this.contentEl)
      .setName("分类和标签")
      .setDesc(this.taxonomySummary())
      .addButton((button) =>
        button.setButtonText("选择…").onClick(() => this.pickTaxonomy()),
      );

    new Setting(this.contentEl)
      .setName("Slug")
      .setDesc("留空自动生成")
      .addText((text) =>
        text.setPlaceholder("custom-url-slug").onChange((value) => {
          this.slug = value;
        }),
      );

    new Setting(this.contentEl)
      .setName("封面")
      .setDesc("选填，本地图片路径")
      .addText((text) =>
        text.setPlaceholder("attachments/cover.png").onChange((value) => {
          this.cover = value;
        }),
      );

    new Setting(this.contentEl)
      .setName("发布时间")
      .setDesc("北京时间，留空就不填")
      .addText((text) => {
        text.inputEl.type = "datetime-local";
        text.setValue(this.publishedAt).onChange((value) => {
          this.publishedAt = value;
        });
      });

    const actions = this.contentEl.createDiv({ cls: "fsb-conflict-actions" });
    new ButtonComponent(actions)
      .setButtonText("创建并打开")
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

  private taxonomySummary(): string {
    const category = this.category.trim() || "不设置";
    const tags = this.tags.length > 0 ? this.tags.join("、") : "无";
    return `分类：${category} · 标签：${tags}`;
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

  private submit(): void {
    const title = this.title.trim();
    if (!title) {
      new Notice("标题不能为空。");
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
      publishedAt: beijingInputToIso(this.publishedAt) ?? "",
    };
    this.close();
    this.onSubmit(form);
  }
}
