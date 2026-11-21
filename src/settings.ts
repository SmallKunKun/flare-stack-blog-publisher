import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type FlareStackBlogPublisher from "./main";
import { describeApiError } from "./api/errors";

export interface PublisherSettings {
  siteUrl: string;
  apiKey: string;
  pullFolder: string;
  newPostFolder: string;
  autoFillPublishedAt: boolean;
  autoCreateTaxonomy: boolean;
  uploadLocalImages: boolean;
  uuidImageNames: boolean;
  convertWikiLinks: boolean;
  openAfterPublish: boolean;
  showInternalProperties: boolean;
}

export const DEFAULT_SETTINGS: PublisherSettings = {
  siteUrl: "",
  apiKey: "",
  pullFolder: "FlareStackBlog",
  newPostFolder: "FlareStackBlog/Drafts",
  autoFillPublishedAt: true,
  autoCreateTaxonomy: true,
  uploadLocalImages: true,
  uuidImageNames: false,
  convertWikiLinks: true,
  openAfterPublish: false,
  showInternalProperties: false,
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
      .setDesc("站点地址，例如 https://blog.example.com")
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
      .setName("API Key")
      .setDesc(
        "博客后台 API Key 页面生成",
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
      .setDesc("读取一次文章列表，校验地址与 Key")
      .addButton((button) =>
        button.setButtonText("测试连接").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("测试中…");
          try {
            const api = this.plugin.createApi();
            if (!api.isConfigured) {
              new Notice("先填写 API Key");
              return;
            }
            const page = await api.listPosts({ limit: 1 });
            new Notice(`连接正常，博客里有 ${page.total} 篇文章`);
          } catch (error) {
            new Notice(`连接失败：${describeApiError(error)}`, 8000);
          } finally {
            button.setDisabled(false);
            button.setButtonText("测试连接");
          }
        }),
      );

    containerEl.createEl("h3", { text: "配置" });

    new Setting(containerEl)
      .setName("拉取文章目录")
      .setDesc("拉取文章存放位置，每篇独立文件夹")
      .addText((text) =>
        text
          .setPlaceholder("FlareStackBlog")
          .setValue(this.plugin.settings.pullFolder)
          .onChange(async (value) => {
            this.plugin.settings.pullFolder = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("新建文章目录")
      .setDesc("新建文章存放位置，每篇独立文件夹")
      .addText((text) =>
        text
          .setPlaceholder("FlareStackBlog/Drafts")
          .setValue(this.plugin.settings.newPostFolder)
          .onChange(async (value) => {
            this.plugin.settings.newPostFolder = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("自动填写发布时间")
      .setDesc("按笔记创建时间生成发布时间")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoFillPublishedAt)
          .onChange(async (value) => {
            this.plugin.settings.autoFillPublishedAt = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("自动创建分类和标签")
      .setDesc("不存在时自动创建，关闭后仅使用现有项")
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
      .setDesc("发布时上传本地图片并替换为URL")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.uploadLocalImages)
          .onChange(async (value) => {
            this.plugin.settings.uploadLocalImages = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("UUID 文件名")
      .setDesc(
        "上传图片使用 UUID 文件名，同图复用同名",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.uuidImageNames)
          .onChange(async (value) => {
            this.plugin.settings.uuidImageNames = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("转换双链")
      .setDesc("[[笔记]]转换为博客链接，未发布笔记仅保留文字")
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
      .setDesc("发布完用浏览器打开文章")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openAfterPublish)
          .onChange(async (value) => {
            this.plugin.settings.openAfterPublish = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("显示内部字段")
      .setDesc(
        "在笔记属性中显示内部字段",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showInternalProperties)
          .onChange(async (value) => {
            this.plugin.settings.showInternalProperties = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
