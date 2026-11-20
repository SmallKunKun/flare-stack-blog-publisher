import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type FlareStackBlogPublisher from "./main";
import { describeApiError } from "./api/errors";

export interface PublisherSettings {
  siteUrl: string;
  apiKey: string;
  defaultCategory: string;
  defaultTags: string;
  autoCreateTaxonomy: boolean;
  publishByDefault: boolean;
  uploadLocalImages: boolean;
  convertWikiLinks: boolean;
  openAfterPublish: boolean;
}

export const DEFAULT_SETTINGS: PublisherSettings = {
  siteUrl: "",
  apiKey: "",
  defaultCategory: "",
  defaultTags: "",
  autoCreateTaxonomy: true,
  publishByDefault: true,
  uploadLocalImages: true,
  convertWikiLinks: true,
  openAfterPublish: false,
};

export class PublisherSettingTab extends PluginSettingTab {
  private readonly plugin: FlareStackBlogPublisher;

  constructor(app: App, plugin: FlareStackBlogPublisher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Flare Stack Blog Publisher" });

    new Setting(containerEl)
      .setName("博客地址")
      .setDesc("站点根地址，例如 https://blog.example.com。不要填写 /api 路径。")
      .addText((text) =>
        text
          .setPlaceholder("https://blog.example.com")
          .setValue(this.plugin.settings.siteUrl)
          .onChange(async (value) => {
            this.plugin.settings.siteUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Admin API Key")
      .setDesc(
        "在博客后台的 API Key 设置中生成。只显示一次，保存在本机 Obsidian 数据中，不会上传到别处。",
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("fsb_...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("测试连接")
      .setDesc("用当前地址和 Key 读取一次文章列表。")
      .addButton((button) =>
        button.setButtonText("测试连接").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("测试中…");
          try {
            const api = this.plugin.createApi();
            if (!api.isConfigured) {
              new Notice("请先填写 Admin API Key。");
              return;
            }
            const page = await api.listPosts({ limit: 1 });
            new Notice(`连接成功，博客共有 ${page.total} 篇文章。`);
          } catch (error) {
            new Notice(`连接失败：${describeApiError(error)}`, 8000);
          } finally {
            button.setDisabled(false);
            button.setButtonText("测试连接");
          }
        }),
      );

    containerEl.createEl("h3", { text: "发布默认值" });

    new Setting(containerEl)
      .setName("默认分类")
      .setDesc("笔记 frontmatter 没有 category 时使用；留空表示不设置。")
      .addText((text) =>
        text
          .setPlaceholder("例如：随笔")
          .setValue(this.plugin.settings.defaultCategory)
          .onChange(async (value) => {
            this.plugin.settings.defaultCategory = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("默认标签")
      .setDesc("笔记 frontmatter 没有 tags 时使用；多个标签用逗号分隔。")
      .addText((text) =>
        text
          .setPlaceholder("例如：Obsidian, 博客")
          .setValue(this.plugin.settings.defaultTags)
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("默认直接发布")
      .setDesc("关闭后，「发布当前笔记」只保存草稿，需要到博客后台手动发布。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.publishByDefault)
          .onChange(async (value) => {
            this.plugin.settings.publishByDefault = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("自动创建分类和标签")
      .setDesc(
        "笔记里的分类或标签在博客中不存在时自动创建。关闭后只使用已有分类和标签。",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoCreateTaxonomy)
          .onChange(async (value) => {
            this.plugin.settings.autoCreateTaxonomy = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("上传本地图片")
      .setDesc(
        "发布时把笔记中引用的本地图片上传到博客媒体库，并替换为博客地址。",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.uploadLocalImages)
          .onChange(async (value) => {
            this.plugin.settings.uploadLocalImages = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("转换双链")
      .setDesc(
        "把 [[笔记]] 转换为指向已发布文章的链接；找不到对应文章时保留显示文字。",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.convertWikiLinks)
          .onChange(async (value) => {
            this.plugin.settings.convertWikiLinks = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("发布后打开网页")
      .setDesc("发布成功后用系统浏览器打开文章页面。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openAfterPublish)
          .onChange(async (value) => {
            this.plugin.settings.openAfterPublish = value;
            await this.plugin.saveSettings();
          }),
      );

    const privacy = containerEl.createEl("p", { cls: "setting-item-description" });
    privacy.setText(
      "本插件只连接你填写的博客地址。仓库与插件代码中不含任何站点、Key 或账号信息。",
    );
  }
}
