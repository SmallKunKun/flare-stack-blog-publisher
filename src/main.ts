import { Notice, Plugin } from "obsidian";
import { BlogApi, normalizeSiteUrl } from "./api/client";
import { describeApiError } from "./api/errors";
import {
  DEFAULT_SETTINGS,
  PublisherSettingTab,
  type PublisherSettings,
} from "./settings";

export default class FlareStackBlogPublisher extends Plugin {
  settings: PublisherSettings = { ...DEFAULT_SETTINGS };
  private statusBarEl!: HTMLElement;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();

    this.addSettingTab(new PublisherSettingTab(this.app, this));

    this.addCommand({
      id: "test-connection",
      name: "测试博客连接",
      callback: async () => {
        try {
          const api = this.createApi();
          if (!api.isConfigured) {
            new Notice("请先在设置中填写 Admin API Key。");
            return;
          }
          const page = await api.listPosts({ limit: 1 });
          new Notice(`连接成功，博客共有 ${page.total} 篇文章。`);
        } catch (error) {
          new Notice(`连接失败：${describeApiError(error)}`, 8000);
        }
      },
    });
  }

  createApi(): BlogApi {
    return new BlogApi({
      siteUrl: this.settings.siteUrl,
      apiKey: this.settings.apiKey,
    });
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<PublisherSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateStatusBar();
  }

  updateStatusBar(): void {
    if (!this.statusBarEl) return;
    if (!this.settings.siteUrl || !this.settings.apiKey) {
      this.statusBarEl.setText("FSB 未配置");
      this.statusBarEl.title = "打开插件设置填写博客地址和 API Key";
      return;
    }
    try {
      const origin = normalizeSiteUrl(this.settings.siteUrl);
      this.statusBarEl.setText(`FSB · ${origin.replace(/^https?:\/\//, "")}`);
      this.statusBarEl.title = "Flare Stack Blog Publisher 已配置";
    } catch {
      this.statusBarEl.setText("FSB 地址无效");
      this.statusBarEl.title = "请检查插件设置中的博客地址";
    }
  }
}
