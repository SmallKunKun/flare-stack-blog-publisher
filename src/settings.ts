import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type FlareStackBlogPublisher from "./main";
import { describeApiError } from "./api/errors";

export interface PublisherSettings {
  siteUrl: string;
  apiKey: string;
  defaultCategory: string;
  defaultTags: string;
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
  defaultCategory: "",
  defaultTags: "",
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
      .setDesc("站点地址，例如 https://blog.example.com，不要带 /api")
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
        "在博客后台的 API Key 页面生成，只显示一次，保存在本机 data.json",
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
      .setDesc("用当前地址和 Key 读一下文章列表")
      .addButton((button) =>
        button.setButtonText("测试连接").onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("测试中…");
          try {
            const api = this.plugin.createApi();
            if (!api.isConfigured) {
              new Notice("先填 API Key");
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

    containerEl.createEl("h3", { text: "发布" });

    new Setting(containerEl)
      .setName("默认分类")
      .setDesc("新建文章时预填，笔记里没有「分类」时也会用，留空就不设置")
      .addText((text) =>
        text
          .setPlaceholder("随笔")
          .setValue(this.plugin.settings.defaultCategory)
          .onChange(async (value) => {
            this.plugin.settings.defaultCategory = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("默认标签")
      .setDesc("新建文章时预填，笔记里没有「标签」时也会用，逗号分隔")
      .addText((text) =>
        text
          .setPlaceholder("Obsidian, 博客")
          .setValue(this.plugin.settings.defaultTags)
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("拉取目录")
      .setDesc("拉取的文章放这里，一篇一个文件夹")
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
      .setDesc("新建的文章放这里，一篇一个文件夹")
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
      .setName("新建文章自动填发布时间")
      .setDesc("用当前北京时间填「日期」，不需要可以关掉")
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
      .setDesc("分类或标签不存在时自动建，关掉就只用现有的")
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
      .setDesc("发布时把本地图片传到媒体库，并换成博客地址")
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
        "上传时用 UUID 当文件名，例如 3c9a1f7e-5b2d-4a8c-9e6f-1d4b7a2c8e90.png，本地文件不动，同一张图复用同一个名字",
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
      .setDesc("把 [[笔记]] 换成博客链接，没发布的笔记只保留文字")
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
        "在笔记属性里显示 fsb_post_id、fsb_url 这类内部字段，一般不用开",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showInternalProperties)
          .onChange(async (value) => {
            this.plugin.settings.showInternalProperties = value;
            await this.plugin.saveSettings();
          }),
      );

    const privacy = containerEl.createEl("p", { cls: "setting-item-description" });
    privacy.setText("只连你填的博客地址，代码里没有站点、Key 或账号信息");
  }
}
