import {
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { BlogApi, normalizeSiteUrl } from "./api/client";
import { describeApiError } from "./api/errors";
import type { AdminPostListItem } from "./api/types";
import { createPostNote, type NewPostForm } from "./create-post";
import { NewPostModal } from "./new-post-modal";
import {
  noteCategory,
  noteCover,
  notePostId,
  notePublishedAt,
  noteSlug,
  noteSummary,
  noteTags,
  noteTitle,
  parseNote,
  stringList,
  stringValue,
} from "./note";
import { postUrlOf, publishNote, type PublishMode } from "./publish";
import {
  confirmPublish,
  type PublishConfirmation,
} from "./publish-confirm-modal";
import { PROPERTY_KEYS, migrateProperties } from "./properties";
import {
  findLocalPostFile,
  localPostIds,
  pullPostToLocal,
} from "./pull";
import { PullConflictModal } from "./pull-conflict-modal";
import { PullPostModal } from "./pull-modal";
import {
  DEFAULT_SETTINGS,
  PublisherSettingTab,
  type PublisherSettings,
} from "./settings";

export default class FlareStackBlogPublisher extends Plugin {
  settings: PublisherSettings = { ...DEFAULT_SETTINGS };
  private statusBarEl!: HTMLElement;
  private readonly viewActions = new Set<HTMLElement>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.applyInternalVisibility();

    this.register(() => {
      for (const action of this.viewActions) action.remove();
      this.viewActions.clear();
      document.body.classList.remove("fsb-show-internal");
    });

    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("fsb-status-bar");
    this.statusBarEl.addEventListener("click", (event) =>
      this.onStatusBarClick(event),
    );
    this.updateStatusBar();

    this.addSettingTab(new PublisherSettingTab(this.app, this));

    this.addRibbonIcon("upload", "发布到博客", () => {
      this.publishActive("publish");
    });

    this.addRibbonIcon("download", "拉取文章", () => {
      void this.openPullModal();
    });

    this.addRibbonIcon("plus", "新建文章", () => {
      this.openNewPostModal();
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.addPublishMenuItems(menu, file);
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, _editor, view) => {
        if (view instanceof MarkdownView && view.file) {
          this.addPublishMenuItems(menu, view.file);
        }
      }),
    );

    this.app.workspace.onLayoutReady(() => this.addViewActions());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.addViewActions()),
    );

    this.addCommand({
      id: "test-connection",
      name: "测试连接",
      callback: () => void this.testConnection(),
    });

    this.addCommand({
      id: "publish-current-note",
      name: "发布当前笔记",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.runPublish(file, "publish");
        return true;
      },
    });

    this.addCommand({
      id: "save-current-note-draft",
      name: "保存为草稿",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.runPublish(file, "draft");
        return true;
      },
    });

    this.addCommand({
      id: "open-current-post",
      name: "打开博客文章",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.openPost(file);
        return true;
      },
    });

    this.addCommand({
      id: "pull-post",
      name: "拉取云端文章",
      callback: () => void this.openPullModal(),
    });

    this.addCommand({
      id: "new-post",
      name: "新建博客文章",
      callback: () => this.openNewPostModal(),
    });

    this.addCommand({
      id: "article-info",
      name: "文章信息",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.openArticleInfoModal(file);
        return true;
      },
    });

    this.addCommand({
      id: "migrate-properties",
      name: "属性改成中文",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file) return false;
        if (!checking) void this.migrateCurrentProperties(file);
        return true;
      },
    });
  }

  private activeMarkdownFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") return null;
    return file;
  }

  private publishActive(mode: PublishMode = "publish"): void {
    const file = this.activeMarkdownFile();
    if (!file) {
      new Notice("先打开一篇 Markdown 笔记。");
      return;
    }
    void this.runPublish(file, mode);
  }

  private publishFile(file: TFile, mode: PublishMode = "publish"): void {
    void this.runPublish(file, mode);
  }

  private addViewActions(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      if (view.containerEl.querySelector(".fsb-publish-action")) continue;

      try {
        const action = view.addAction("upload", "发布到博客", () => {
          if (view.file) this.publishFile(view.file, "publish");
          else this.publishActive("publish");
        });
        action.addClass("fsb-publish-action");
        this.viewActions.add(action);
      } catch (error) {
        console.error("Flare Stack Blog: could not add view action", error);
      }
    }
  }

  private addPublishMenuItems(menu: Menu, file: TFile): void {
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("发布到博客")
        .setIcon("upload")
        .onClick(() => this.publishFile(file, "publish")),
    );
    menu.addItem((item) =>
      item
        .setTitle("保存为草稿")
        .setIcon("save")
        .onClick(() => this.publishFile(file, "draft")),
    );
    menu.addItem((item) =>
      item
        .setTitle("打开博客文章")
        .setIcon("external-link")
        .onClick(() => void this.openPost(file)),
    );
    menu.addItem((item) =>
      item
        .setTitle("文章信息…")
        .setIcon("info")
        .onClick(() => void this.openArticleInfoModal(file)),
    );
  }

  private onStatusBarClick(event: MouseEvent): void {
    if (!this.isConfigured()) {
      this.openPluginSettings();
      return;
    }

    const file = this.activeMarkdownFile();
    const noFile = file === null;
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setTitle("新建文章")
        .setIcon("plus")
        .onClick(() => this.openNewPostModal()),
    );
    menu.addItem((item) =>
      item
        .setTitle("拉取文章")
        .setIcon("download")
        .onClick(() => void this.openPullModal()),
    );
    menu.addItem((item) =>
      item
        .setTitle("文章信息")
        .setIcon("info")
        .setDisabled(noFile)
        .onClick(() => {
          if (file) void this.openArticleInfoModal(file);
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("保存草稿")
        .setIcon("save")
        .setDisabled(noFile)
        .onClick(() => {
          if (file) void this.runPublish(file, "draft");
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("发布文章")
        .setIcon("upload")
        .setDisabled(noFile)
        .onClick(() => {
          if (file) void this.runPublish(file, "publish");
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("打开文章")
        .setIcon("external-link")
        .setDisabled(noFile)
        .onClick(() => {
          if (file) void this.openPost(file);
        }),
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("测试连接")
        .setIcon("plug")
        .onClick(() => void this.testConnection()),
    );
    menu.addItem((item) =>
      item
        .setTitle("插件设置")
        .setIcon("settings")
        .onClick(() => this.openPluginSettings()),
    );
    menu.showAtMouseEvent(event);
  }

  private isConfigured(): boolean {
    return (
      this.settings.siteUrl.trim().length > 0 &&
      this.settings.apiKey.trim().length > 0
    );
  }

  private openPluginSettings(): void {
    const setting = (
      this.app as unknown as {
        setting?: {
          open?: () => void;
          openTabById?: (id: string) => void;
        };
      }
    ).setting;
    setting?.open?.();
    setting?.openTabById?.(this.manifest.id);
  }

  private async testConnection(): Promise<void> {
    try {
      if (!this.isConfigured()) {
        new Notice("还没填博客地址或 API Key。");
        this.openPluginSettings();
        return;
      }
      const api = this.createApi();
      const page = await api.listPosts({ limit: 1 });
      new Notice(`连接正常，博客里有 ${page.total} 篇文章。`);
    } catch (error) {
      new Notice(`连接失败：${describeApiError(error)}`, 8000);
    }
  }

  private async runPublish(file: TFile, mode: PublishMode): Promise<void> {
    if (!this.isConfigured()) {
      new Notice("还没填博客地址或 API Key。");
      this.openPluginSettings();
      return;
    }

    let details: PublishConfirmation;
    try {
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      details = {
        mode,
        title: noteTitle(note.frontmatter, file.basename),
        path: file.path,
        category: noteCategory(note.frontmatter) ?? "",
        tags: noteTags(note.frontmatter),
        publishedAt: notePublishedAt(note.frontmatter),
        postId: notePostId(note.frontmatter),
      };
    } catch (error) {
      console.error("Flare Stack Blog read note failed", error);
      new Notice(`读取笔记失败：${describeApiError(error)}`, 8000);
      return;
    }

    if (!(await confirmPublish(this.app, details))) return;

    new Notice(mode === "publish" ? "正在发布…" : "正在保存草稿…");

    try {
      const api = this.createApi();
      const outcome = await publishNote(
        { app: this.app, api, settings: this.settings },
        file,
        mode,
      );

      if (!outcome) {
        new Notice("已取消。");
        return;
      }

      if (outcome.published) {
        if (outcome.postUrl) {
          new Notice(`发布成功：${outcome.title}\n${outcome.postUrl}`, 8000);
          if (this.settings.openAfterPublish) {
            window.open(outcome.postUrl, "_blank");
          }
        } else {
          new Notice(`发布成功：${outcome.title}`);
        }
      } else if (outcome.created) {
        new Notice(`已保存草稿：${outcome.title}`);
      } else {
        new Notice(`已更新草稿：${outcome.title}`);
      }

      if (outcome.warnings.length > 0) {
        new Notice(outcome.warnings.join("\n"), 8000);
      }
    } catch (error) {
      console.error("Flare Stack Blog publish failed", error);
      new Notice(`发布失败：${describeApiError(error)}`, 10000);
    }
  }

  createApi(): BlogApi {
    return new BlogApi({
      siteUrl: this.settings.siteUrl,
      apiKey: this.settings.apiKey,
    });
  }

  private tryCreateApi(): BlogApi | null {
    if (!this.isConfigured()) return null;
    try {
      return this.createApi();
    } catch {
      return null;
    }
  }

  private async openPost(file: TFile): Promise<void> {
    if (!this.isConfigured()) {
      new Notice("还没填博客地址或 API Key。");
      this.openPluginSettings();
      return;
    }

    try {
      const api = this.createApi();
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      const storedUrl = stringValue(note.frontmatter.fsb_url);
      if (storedUrl && isHttpUrl(storedUrl)) {
        window.open(storedUrl, "_blank");
        return;
      }

      const postId = notePostId(note.frontmatter);
      if (postId === undefined) {
        new Notice("这篇还没关联博客文章，先发布一次。");
        return;
      }

      const post = await api.getPost(postId);
      const url = postUrlOf(api, post);
      if (!url) {
        new Notice("文章还没发布，没有公开地址。");
        return;
      }
      window.open(url, "_blank");
    } catch (error) {
      console.error("Flare Stack Blog open post failed", error);
      new Notice(`打开失败：${describeApiError(error)}`, 8000);
    }
  }

  private async openPullModal(): Promise<void> {
    if (!this.isConfigured()) {
      new Notice("还没填博客地址或 API Key。");
      this.openPluginSettings();
      return;
    }

    try {
      const api = this.createApi();
      const localIds = await localPostIds(this.app, this.settings.pullFolder);
      new PullPostModal(
        this.app,
        api,
        (postId) => localIds.has(postId),
        (post) => void this.handlePullChoice(api, post),
      ).open();
    } catch (error) {
      console.error("Flare Stack Blog pull list failed", error);
      new Notice(`读取文章列表失败：${describeApiError(error)}`, 8000);
    }
  }

  private openNewPostModal(): void {
    new NewPostModal(
      this.app,
      this.tryCreateApi(),
      this.settings.autoFillPublishedAt,
      this.settings.defaultCategory,
      stringList(this.settings.defaultTags),
      (form) => {
        void this.createNewPost(form);
      },
    ).open();
  }

  private async createNewPost(form: NewPostForm): Promise<void> {
    try {
      const file = await createPostNote(
        this.app,
        this.settings.newPostFolder,
        form,
      );
      await this.openVaultFile(file);
      new Notice(`已创建：${form.title}`, 5000);
    } catch (error) {
      console.error("Flare Stack Blog create post failed", error);
      new Notice(`创建失败：${describeApiError(error)}`, 8000);
    }
  }

  private async openArticleInfoModal(file: TFile): Promise<void> {
    try {
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      const initial: NewPostForm = {
        title: noteTitle(note.frontmatter, file.basename),
        summary: noteSummary(note.frontmatter) ?? "",
        category: noteCategory(note.frontmatter) ?? "",
        tags: noteTags(note.frontmatter),
        slug: noteSlug(note.frontmatter) ?? "",
        cover: noteCover(note.frontmatter) ?? "",
        publishedAt: notePublishedAt(note.frontmatter) ?? "",
      };

      new NewPostModal(
        this.app,
        this.tryCreateApi(),
        false,
        "",
        [],
        (form) => void this.saveArticleInfo(file, form),
        { mode: "edit", initial },
      ).open();
    } catch (error) {
      console.error("Flare Stack Blog read article info failed", error);
      new Notice(`读取文章信息失败：${describeApiError(error)}`, 8000);
    }
  }

  private async saveArticleInfo(
    file: TFile,
    form: NewPostForm,
  ): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        migrateProperties(frontmatter);
        frontmatter[PROPERTY_KEYS.title] = form.title.trim();
        frontmatter[PROPERTY_KEYS.summary] = form.summary.trim();
        frontmatter[PROPERTY_KEYS.slug] = form.slug.trim();
        frontmatter[PROPERTY_KEYS.category] = form.category.trim();
        frontmatter[PROPERTY_KEYS.tags] = form.tags;
        frontmatter[PROPERTY_KEYS.cover] = form.cover.trim();
        if (form.publishedAt) {
          frontmatter[PROPERTY_KEYS.publishedAt] = form.publishedAt;
        } else {
          delete frontmatter[PROPERTY_KEYS.publishedAt];
        }
        delete frontmatter.category;
        delete frontmatter.categories;
        delete frontmatter.tags;
        delete frontmatter.tag;
        delete frontmatter.publishedAt;
        delete frontmatter.cover_image;
        delete frontmatter.image;
      });
      new Notice("文章信息已保存。");
    } catch (error) {
      console.error("Flare Stack Blog save article info failed", error);
      new Notice(`保存文章信息失败：${describeApiError(error)}`, 8000);
    }
  }

  private async migrateCurrentProperties(file: TFile): Promise<void> {
    try {
      let changed = false;
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        changed = migrateProperties(frontmatter);
      });
      new Notice(changed ? "属性已改成中文。" : "没有需要转换的属性。");
    } catch (error) {
      console.error("Flare Stack Blog migrate properties failed", error);
      new Notice(`转换属性失败：${describeApiError(error)}`, 8000);
    }
  }

  private async handlePullChoice(
    api: BlogApi,
    post: AdminPostListItem,
  ): Promise<void> {
    try {
      const existing = await findLocalPostFile(
        this.app,
        this.settings.pullFolder,
        post.id,
      );
      if (existing) {
        new PullConflictModal(
          this.app,
          post.title,
          () => void this.openVaultFile(existing),
          () => void this.pullAndOpen(api, post, existing),
        ).open();
        return;
      }
      await this.pullAndOpen(api, post, null);
    } catch (error) {
      console.error("Flare Stack Blog pull failed", error);
      new Notice(`拉取失败：${describeApiError(error)}`, 10000);
    }
  }

  private async pullAndOpen(
    api: BlogApi,
    post: AdminPostListItem,
    existing: TFile | null,
  ): Promise<void> {
    new Notice(`正在拉取：${post.title}`);
    try {
      const file = await pullPostToLocal(
        this.app,
        api,
        post,
        this.settings.pullFolder,
        existing,
      );
      await this.openVaultFile(file);
      new Notice(`已拉取：${post.title}\n${file.path}`, 6000);
    } catch (error) {
      console.error("Flare Stack Blog pull failed", error);
      new Notice(`拉取失败：${describeApiError(error)}`, 10000);
    }
  }

  private async openVaultFile(file: TFile): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) {
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
        return;
      }
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<PublisherSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateStatusBar();
    this.applyInternalVisibility();
  }

  private applyInternalVisibility(): void {
    document.body.classList.toggle(
      "fsb-show-internal",
      this.settings.showInternalProperties,
    );
  }

  updateStatusBar(): void {
    if (!this.statusBarEl) return;
    if (!this.isConfigured()) {
      this.statusBarEl.setText("FSB 未设置");
      this.statusBarEl.title = "点这里打开插件设置";
      return;
    }
    try {
      const origin = normalizeSiteUrl(this.settings.siteUrl);
      this.statusBarEl.setText(`FSB · ${origin.replace(/^https?:\/\//, "")}`);
      this.statusBarEl.title = "点这里打开发布菜单";
    } catch {
      this.statusBarEl.setText("FSB 地址有误");
      this.statusBarEl.title = "检查一下设置里的博客地址";
    }
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
