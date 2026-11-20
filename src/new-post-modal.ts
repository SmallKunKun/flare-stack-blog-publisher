import {
  ButtonComponent,
  Modal,
  Notice,
  Setting,
  type App,
} from "obsidian";
import type { NewPostForm } from "./create-post";

export class NewPostModal extends Modal {
  private title = "";
  private summary = "";
  private category = "";
  private tags = "";
  private slug = "";
  private cover = "";
  private titleInput: HTMLInputElement | null = null;

  constructor(
    app: App,
    private readonly onSubmit: (form: NewPostForm) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("fsb-new-post-modal");
    this.titleEl.setText("新建博客文章");
    this.contentEl.createEl("p", {
      text: "属性会预先写好，创建后直接填写正文即可。",
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
        .setPlaceholder("可选，显示在列表和搜索结果里")
        .onChange((value) => {
          this.summary = value;
        }),
    );

    new Setting(this.contentEl).setName("分类").addText((text) =>
      text.setPlaceholder("可选").onChange((value) => {
        this.category = value;
      }),
    );

    new Setting(this.contentEl)
      .setName("标签")
      .setDesc("用逗号分隔")
      .addText((text) =>
        text.setPlaceholder("例如：Obsidian, 博客").onChange((value) => {
          this.tags = value;
        }),
      );

    new Setting(this.contentEl)
      .setName("Slug")
      .setDesc("留空则由博客自动生成")
      .addText((text) =>
        text.setPlaceholder("custom-url-slug").onChange((value) => {
          this.slug = value;
        }),
      );

    new Setting(this.contentEl)
      .setName("封面")
      .setDesc("可选，本地图片路径")
      .addText((text) =>
        text.setPlaceholder("attachments/cover.png").onChange((value) => {
          this.cover = value;
        }),
      );

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

  private submit(): void {
    const title = this.title.trim();
    if (!title) {
      new Notice("请填写文章标题。");
      this.titleInput?.focus();
      return;
    }

    const tags = this.tags
      .split(/[,，]/)
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter((tag) => tag.length > 0);

    const form: NewPostForm = {
      title,
      summary: this.summary,
      category: this.category,
      tags,
      slug: this.slug,
      cover: this.cover,
    };
    this.close();
    this.onSubmit(form);
  }
}
