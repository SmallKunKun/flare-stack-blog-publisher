import {
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { BlogApi, normalizeSiteUrl } from "./api/client";
import { BlogApiError, describeApiError } from "./api/errors";
import type { AdminPostListItem } from "./api/types";
import { confirmAction } from "./confirm-modal";
import { createPostNote, type NewPostForm } from "./create-post";
import { DeletePostModal } from "./delete-post-modal";
import { MediaLibraryModal } from "./media-library";
import { NewPostModal } from "./new-post-modal";
import {
  noteCategory,
  noteCover,
  noteCoverMediaId,
  notePostId,
  notePublishedAt,
  noteSlug,
  noteSummary,
  noteTags,
  noteTitle,
  numberValue,
  parseNote,
  stringValue,
} from "./note";
import { postUrlOf, publishNote, type PublishMode } from "./publish";
import {
  confirmPublish,
  choosePublishMode,
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
import { normalizeFolder } from "./vault-paths";

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

    // Keep the elements and arrange them explicitly after Obsidian has added
    // the buttons to the ribbon.
    const newPostIcon = this.addRibbonIcon("plus", "新建文章", () => {
      this.openNewPostModal();
    });
    const pullIcon = this.addRibbonIcon("download", "拉取文章", () => {
      void this.openPullModal();
    });
    const mediaIcon = this.addRibbonIcon("image", "媒体库", () => {
      void this.openMediaLibrary();
    });
    const infoIcon = this.addRibbonIcon("info", "文章信息", () => {
      this.openActiveArticleInfo();
    });
    const publishIcon = this.addRibbonIcon("upload", "发布文章", () => {
      this.publishActiveChoice();
    });
    const ribbonIcons = [
      newPostIcon,
      pullIcon,
      mediaIcon,
      infoIcon,
      publishIcon,
    ];
    window.setTimeout(() => this.arrangeRibbon(ribbonIcons), 0);

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

    this.app.workspace.onLayoutReady(() => {
      this.arrangeRibbon(ribbonIcons);
      this.addViewActions();
    });
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.addViewActions();
        this.arrangeRibbon(ribbonIcons);
      }),
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
        if (!file || !this.hasPublishedLink(file)) return false;
        if (!checking) void this.openPost(file);
        return true;
      },
    });

    this.addCommand({
      id: "unpublish-current-post",
      name: "取消发布",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file || !this.canUnpublish(file)) return false;
        if (!checking) void this.unpublishPost(file);
        return true;
      },
    });

    this.addCommand({
      id: "delete-post",
      name: "删除文章",
      checkCallback: (checking) => {
        const file = this.activeMarkdownFile();
        if (!file || !this.isBlogArticle(file)) return false;
        if (!checking) void this.openDeletePostModal(file);
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
      id: "open-media-library",
      name: "媒体库",
      callback: () => void this.openMediaLibrary(),
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

  private hasPublishedLink(file: TFile): boolean {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return Boolean(stringValue(frontmatter?.fsb_url));
  }

  private canUnpublish(file: TFile): boolean {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return (
      Boolean(stringValue(frontmatter?.fsb_url)) &&
      numberValue(frontmatter?.fsb_post_id) !== undefined
    );
  }

  private isBlogArticle(file: TFile): boolean {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (numberValue(frontmatter?.fsb_post_id) !== undefined) return true;
    if (stringValue(frontmatter?.fsb_url)) return true;

    const folders = [
      normalizeFolder(this.settings.pullFolder, "FlareStackBlog"),
      normalizeFolder(
        this.settings.newPostFolder,
        "FlareStackBlog/Drafts",
      ),
    ];
    return folders.some((folder) => file.path.startsWith(`${folder}/`));
  }

  private publishActiveChoice(): void {
    const file = this.activeMarkdownFile();
    if (!file) {
      new Notice("请先打开 Markdown 笔记");
      return;
    }
    void this.runPublishChoice(file);
  }

  private openActiveArticleInfo(): void {
    const file = this.activeMarkdownFile();
    if (!file) {
      new Notice("请先打开 Markdown 笔记");
      return;
    }
    void this.openArticleInfoModal(file);
  }

  private arrangeRibbon(icons: HTMLElement[]): void {
    const parent = icons[0]?.parentElement;
    if (!parent) return;
    const reversed =
      getComputedStyle(parent).flexDirection === "column-reverse";
    const ordered = reversed ? [...icons].reverse() : icons;
    for (const icon of ordered) parent.appendChild(icon);
  }

  private publishChoice(file: TFile): void {
    void this.runPublishChoice(file);
  }

  private publishFile(file: TFile, mode: PublishMode = "publish"): void {
    void this.runPublish(file, mode);
  }

  private addViewActions(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;

      if (!view.containerEl.querySelector(".fsb-publish-action")) {
        try {
          const action = view.addAction("upload", "发布文章", () => {
            if (view.file) this.publishChoice(view.file);
            else this.publishActiveChoice();
          });
          action.addClass("fsb-publish-action");
          this.viewActions.add(action);
        } catch (error) {
          console.error("Flare Stack Blog: could not add view action", error);
        }
      }

      if (!view.containerEl.querySelector(".fsb-info-action")) {
        try {
          const action = view.addAction("info", "文章信息", () => {
            if (view.file) void this.openArticleInfoModal(view.file);
            else new Notice("请先打开 Markdown 笔记");
          });
          action.addClass("fsb-info-action");
          this.viewActions.add(action);
        } catch (error) {
          console.error(
            "Flare Stack Blog: could not add article info action",
            error,
          );
        }
      }

      if (!view.containerEl.querySelector(".fsb-library-action")) {
        try {
          const action = view.addAction("image", "媒体库", () => {
            void this.openMediaLibrary();
          });
          action.addClass("fsb-library-action");
          this.viewActions.add(action);
        } catch (error) {
          console.error(
            "Flare Stack Blog: could not add media library action",
            error,
          );
        }
      }
    }
  }

  private addPublishMenuItems(menu: Menu, file: TFile): void {
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("发布文章")
        .setIcon("upload")
        .onClick(() => this.publishFile(file, "publish")),
    );
    menu.addItem((item) =>
      item
        .setTitle("保存草稿")
        .setIcon("save")
        .onClick(() => this.publishFile(file, "draft")),
    );
    menu.addItem((item) =>
      item
        .setTitle("取消发布")
        .setIcon("eye-off")
        .setDisabled(!this.canUnpublish(file))
        .onClick(() => void this.unpublishPost(file)),
    );
    menu.addItem((item) =>
      item
        .setTitle("打开文章")
        .setIcon("external-link")
        .setDisabled(!this.hasPublishedLink(file))
        .onClick(() => void this.openPost(file)),
    );
    menu.addItem((item) =>
      item
        .setTitle("文章信息")
        .setIcon("info")
        .onClick(() => void this.openArticleInfoModal(file)),
    );
    menu.addItem((item) =>
      item
        .setTitle("删除文章")
        .setIcon("trash-2")
        .setDisabled(!this.isBlogArticle(file))
        .onClick(() => void this.openDeletePostModal(file)),
    );
  }

  private onStatusBarClick(event: MouseEvent): void {
    if (!this.isConfigured()) {
      this.openPluginSettings();
      return;
    }

    const file = this.activeMarkdownFile();
    const noFile = file === null;
    const canOpen = file !== null && this.hasPublishedLink(file);
    const canUnpublish = file !== null && this.canUnpublish(file);
    const canDelete = file !== null && this.isBlogArticle(file);
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
        .setTitle("媒体库")
        .setIcon("image")
        .onClick(() => void this.openMediaLibrary()),
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
        .setTitle("发布文章")
        .setIcon("upload")
        .setDisabled(noFile)
        .onClick(() => {
          if (file) this.publishChoice(file);
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("取消发布")
        .setIcon("eye-off")
        .setDisabled(!canUnpublish)
        .onClick(() => {
          if (file) void this.unpublishPost(file);
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("打开文章")
        .setIcon("external-link")
        .setDisabled(!canOpen)
        .onClick(() => {
          if (file) void this.openPost(file);
        }),
    );
    menu.addItem((item) =>
      item
        .setTitle("删除文章")
        .setIcon("trash-2")
        .setDisabled(!canDelete)
        .onClick(() => {
          if (file) void this.openDeletePostModal(file);
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

  private requireConfigured(): boolean {
    if (this.isConfigured()) return true;
    new Notice("请先配置博客地址和 API Key");
    this.openPluginSettings();
    return false;
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
      if (!this.requireConfigured()) return;
      const api = this.createApi();
      const page = await api.listPosts({ limit: 1 });
      new Notice(`连接成功，共 ${page.total} 篇文章`);
    } catch (error) {
      new Notice(`连接失败：${describeApiError(error)}`, 8000);
    }
  }

  private async runPublish(
    file: TFile,
    mode: PublishMode,
    skipConfirm = false,
  ): Promise<void> {
    if (!this.requireConfigured()) return;

    if (!skipConfirm) {
      let details: PublishConfirmation;
      try {
        details = await this.buildPublishDetails(file, mode);
      } catch (error) {
        console.error("Flare Stack Blog read note failed", error);
        new Notice(`读取笔记失败：${describeApiError(error)}`, 8000);
        return;
      }
      if (!(await confirmPublish(this.app, details))) return;
    }

    new Notice(mode === "publish" ? "正在发布…" : "正在保存草稿…");

    try {
      const api = this.createApi();
      const outcome = await publishNote(
        { app: this.app, api, settings: this.settings },
        file,
        mode,
      );

      if (!outcome) {
        new Notice("操作已取消");
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

  private async runPublishChoice(file: TFile): Promise<void> {
    if (!this.requireConfigured()) return;

    let details: PublishConfirmation;
    try {
      details = await this.buildPublishDetails(file, "publish");
    } catch (error) {
      console.error("Flare Stack Blog read note failed", error);
      new Notice(`读取笔记失败：${describeApiError(error)}`, 8000);
      return;
    }

    const mode = await choosePublishMode(this.app, details);
    if (!mode) return;
    await this.runPublish(file, mode, true);
  }

  private async buildPublishDetails(
    file: TFile,
    mode: PublishMode,
  ): Promise<PublishConfirmation> {
    const raw = await this.app.vault.read(file);
    const note = parseNote(raw);
    return {
      mode,
      title: noteTitle(note.frontmatter, file.basename),
      summary: noteSummary(note.frontmatter) ?? "",
      slug: noteSlug(note.frontmatter) ?? "",
      cover: noteCover(note.frontmatter) ?? "",
      path: file.path,
      category: noteCategory(note.frontmatter) ?? "",
      tags: noteTags(note.frontmatter),
      publishedAt: notePublishedAt(note.frontmatter),
      postId: notePostId(note.frontmatter),
    };
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
    if (!this.requireConfigured()) return;

    try {
      const api = this.createApi();
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      const postId = notePostId(note.frontmatter);
      if (postId !== undefined) {
        const post = await api.getPost(postId);
        const url = postUrlOf(api, post);
        if (!url) {
          new Notice("文章尚未发布，暂无公开地址");
          return;
        }
        window.open(url, "_blank");
        return;
      }

      const storedUrl = stringValue(note.frontmatter.fsb_url);
      if (storedUrl && isHttpUrl(storedUrl)) {
        window.open(storedUrl, "_blank");
        return;
      }

      new Notice("该笔记尚未关联博客文章，请先发布");
    } catch (error) {
      console.error("Flare Stack Blog open post failed", error);
      new Notice(`打开失败：${describeApiError(error)}`, 8000);
    }
  }

  private async unpublishPost(file: TFile): Promise<void> {
    if (!this.requireConfigured()) return;

    let postId: number | undefined;
    let title = file.basename;
    try {
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      postId = notePostId(note.frontmatter);
      title = noteTitle(note.frontmatter, file.basename);
    } catch (error) {
      console.error("Flare Stack Blog read note failed", error);
      new Notice(`读取笔记失败：${describeApiError(error)}`, 8000);
      return;
    }

    if (postId === undefined) {
      new Notice("该笔记尚未关联云端文章");
      return;
    }

    const confirmed = await confirmAction(this.app, {
      title: "取消发布",
      message: `取消发布《${title}》？公开页面将下线，文章转为草稿，草稿内容保留`,
      confirmText: "取消发布",
    });
    if (!confirmed) return;

    try {
      const api = this.createApi();
      new Notice("正在取消发布…");
      await api.unpublishPost(postId);
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        delete frontmatter.fsb_url;
      });
      new Notice(`已取消发布：${title}`);
    } catch (error) {
      console.error("Flare Stack Blog unpublish failed", error);
      new Notice(`取消发布失败：${describeApiError(error)}`, 10000);
    }
  }

  private async openDeletePostModal(file: TFile): Promise<void> {
    let postId: number | undefined;
    let title = file.basename;

    try {
      const raw = await this.app.vault.read(file);
      const note = parseNote(raw);
      postId = notePostId(note.frontmatter);
      title = noteTitle(note.frontmatter, file.basename);
    } catch (error) {
      console.error("Flare Stack Blog read note failed", error);
      new Notice(`读取笔记失败：${describeApiError(error)}`, 8000);
      return;
    }

    new DeletePostModal(
      this.app,
      title,
      postId !== undefined,
      () => void this.deleteArticle(file, title, postId),
    ).open();
  }

  private async deleteArticle(
    file: TFile,
    title: string,
    postId: number | undefined,
  ): Promise<void> {
    if (postId !== undefined && !this.requireConfigured()) return;

    let remoteState = "none";

    try {
      if (postId !== undefined) {
        const api = this.createApi();
        new Notice("正在删除云端文章…");
        try {
          await api.deletePost(postId);
          remoteState = "deleted";
        } catch (error) {
          if (!(error instanceof BlogApiError) || error.status !== 404) {
            throw error;
          }
          remoteState = "missing";
        }
      }

      new Notice("正在删除本地文件…");
      await this.app.fileManager.trashFile(file);

      if (remoteState === "deleted") {
        new Notice(`已删除云端与本地：${title}`);
      } else if (remoteState === "missing") {
        new Notice(`云端文章不存在，已删除本地：${title}`);
      } else {
        new Notice(`已删除本地：${title}`);
      }
    } catch (error) {
      console.error("Flare Stack Blog delete post failed", error);
      new Notice(
        remoteState === "deleted"
          ? `云端已删除，本地删除失败：${describeApiError(error)}`
          : `删除失败：${describeApiError(error)}`,
        10000,
      );
    }
  }

  private async openPullModal(): Promise<void> {
    if (!this.requireConfigured()) return;

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
      new Notice(`获取文章列表失败：${describeApiError(error)}`, 8000);
    }
  }

  private async openMediaLibrary(): Promise<void> {
    if (!this.requireConfigured()) return;

    try {
      const api = this.createApi();
      new MediaLibraryModal(
        this.app,
        api,
        this.settings.uuidImageNames,
      ).open();
    } catch (error) {
      console.error("Flare Stack Blog media library failed", error);
      new Notice(`打开媒体库失败：${describeApiError(error)}`, 8000);
    }
  }

  private openNewPostModal(): void {
    new NewPostModal(
      this.app,
      this.tryCreateApi(),
      this.settings.autoFillPublishedAt,
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
        coverMediaId: noteCoverMediaId(note.frontmatter),
        publishedAt: notePublishedAt(note.frontmatter) ?? "",
      };

      new NewPostModal(
        this.app,
        this.tryCreateApi(),
        false,
        (form) => void this.saveArticleInfo(file, form),
        { mode: "edit", initial, sourcePath: file.path },
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
        if (form.coverMediaId !== undefined) {
          frontmatter.fsb_cover_media_id = form.coverMediaId;
        } else {
          delete frontmatter.fsb_cover_media_id;
        }
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
      new Notice("文章信息已保存");
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
      new Notice(changed ? "属性已转换为中文" : "无需转换");
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
      this.statusBarEl.setText("FSB 未配置");
      this.statusBarEl.title = "点这里打开插件设置";
      return;
    }
    try {
      const origin = normalizeSiteUrl(this.settings.siteUrl);
      this.statusBarEl.setText(`FSB · ${origin.replace(/^https?:\/\//, "")}`);
      this.statusBarEl.title = "点这里打开发布菜单";
    } catch {
      this.statusBarEl.setText("FSB 地址无效");
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
