# Flare Stack Blog Publisher

在 Obsidian 里写完，直接发到 [Flare Stack Blog](https://github.com/du2333/flare-stack-blog)。

插件只调用博客的 Admin API，不改博客代码，也不关心它怎么部署。

> 第三方插件，不是 Flare Stack Blog 官方项目。
>
> 仓库里没有站点地址、API Key 或账号信息，这些只存在你本机。

## 功能

- 发布笔记，或只存草稿
- 左侧栏、笔记右上角、状态栏、右键菜单都有入口
- 新建文章时把 frontmatter 写好，发布时间默认填当前北京时间
- 分类单选、标签多选，可以从云端已有项里挑
- 从云端拉文章到本地，一篇一个文件夹
- 同步分类和标签，没有就自动建
- 本地图片自动上传，可选 UUID 文件名
- `[[双链]]` 自动换成博客链接
- 首次发布按标题查重，之后靠 `fsb_post_id` 更新
- 发布后可以直接在浏览器打开

## 安装

需要 Node.js 20 或更高版本。

### 装到本机 vault

```bash
git clone <this-repository>
cd obsidian-flare-stack-blog
npm install

# 自动找 vault；有多个会问你选哪个
npm run install:plugin

# 也可以直接指定
npm run install:plugin -- /path/to/MyVault
```

经常改代码的话，用符号链接：

```bash
npm run link:plugin
npm run dev
```

只会链接 `main.js`、`manifest.json`、`styles.css` 三个文件，`data.json`
还在 vault 里。改完在 Obsidian 执行「重新加载应用」就行。Windows 不允许
文件符号链接时会自动改成复制。

装完重启 Obsidian，到「设置 → 第三方插件」启用 **Flare Stack Blog Publisher**。

### 用 BRAT 安装

先把仓库推到 GitHub，然后打 tag：

```bash
git tag 0.1.0
git push origin 0.1.0
```

GitHub Actions 会构建并创建 Release，附上 `main.js`、`manifest.json`、
`styles.css` 和 zip 包。

在 Obsidian 里装 **BRAT**，打开 **Add Beta Plugin**，填：

```text
你的GitHub用户名/obsidian-flare-stack-blog
```

之后有新版本 BRAT 会自己更新。仓库需要是公开的。

### 手动安装

下载 Release 里的 `flare-stack-blog-publisher.zip`，解压到：

```text
<vault>/.obsidian/plugins/flare-stack-blog-publisher/
```

重启 Obsidian，启用插件。

## 设置

| 设置 | 说明 |
| --- | --- |
| 博客地址 | 例如 `https://blog.example.com`，不要带 `/api` |
| Admin API Key | 在博客后台的 API Key 页面生成，只显示一次 |
| 默认分类 | 新建文章时预填，也用于没有 `category` 的笔记 |
| 默认标签 | 新建文章时预填，也用于没有 `tags` 的笔记 |
| 拉取目录 | 云端文章放这里，一篇一个文件夹 |
| 新建文章目录 | 新建的文章放这里，一篇一个文件夹 |
| 新建文章自动填发布时间 | 用当前北京时间填 `publishedAt` |
| 自动创建分类和标签 | 分类或标签不存在时自动建 |
| 上传本地图片 | 发布时把本地图片传到媒体库，并换成博客地址 |
| UUID 文件名 | 上传时用 UUID 当文件名，本地文件不动 |
| 转换双链 | 把 `[[笔记]]` 换成博客链接 |
| 发布后打开网页 | 发布完用浏览器打开文章 |

填完可以点「测试连接」看看地址和 Key 对不对。

API Key 就是管理员权限。只在自己的电脑上用，别提交到仓库。插件把它存在
Obsidian 的 `data.json` 里，这个文件已经在 `.gitignore` 中。

## 使用

### 入口

| 位置 | 作用 |
| --- | --- |
| 左侧栏上传图标 | 发布当前笔记 |
| 左侧栏下载图标 | 拉取云端文章 |
| 左侧栏加号图标 | 新建文章 |
| 笔记右上角上传图标 | 发布当前笔记 |
| 底部状态栏 `FSB · 域名` | 打开发布菜单 |
| 文件列表右键 | 发布、存草稿、打开文章、设置发布时间、设置分类和标签 |
| 编辑器右键 | 发布、存草稿、打开文章、设置发布时间、设置分类和标签 |

没填地址或 Key 时，点状态栏会直接打开设置。

发布按钮就是直接发布。只想存草稿，用右键菜单、状态栏菜单，或者命令
「保存为草稿」。

也可以在「设置 → 快捷键」里给「发布当前笔记」绑一个快捷键。

### 命令

| 命令 | 作用 |
| --- | --- |
| 发布当前笔记 | 新建或更新文章并发布 |
| 保存为草稿 | 只写草稿，不公开 |
| 打开博客文章 | 打开 frontmatter 里的公开地址 |
| 拉取云端文章 | 打开云端文章列表 |
| 新建博客文章 | 填属性并创建本地草稿 |
| 设置发布时间 | 修改或清除当前笔记的 `publishedAt` |
| 设置分类和标签 | 从云端已有分类/标签里选，也可以填新的 |
| 测试连接 | 读一下文章列表，确认配置 |

第一次发布时，如果博客里有标题完全相同的文章，插件会问你是更新还是新建。
选完会把文章 id 写进 frontmatter，下次就不问了。

### 新建文章

点左侧栏的加号，或状态栏菜单「新建文章…」。填标题、摘要、分类和标签、slug、
封面和发布时间。标题必填，其他可以空着。分类和标签点「选择…」可以从云端已有
项里挑；也可以直接输入新的，发布时会自动创建。发布时间默认是当前北京时间，可以改或清空。

建好后笔记会直接打开，frontmatter 长这样：

```yaml
---
title: 文章标题
slug: ""
summary: ""
category: ""
tags: []
cover: ""
publishedAt: 2026-11-21T14:30:00+08:00
---
```

`category` 只能填一个，`tags` 可以多个。

发布时间不能晚于当前时间，否则博客会拒绝发布。

往下写正文，然后点发布。

默认目录：

```text
FlareStackBlog/
└── Drafts/
    └── 文章标题/
        └── 文章标题.md
```

同名文件夹已存在时会加 `-2`、`-3`。

### 设置发布时间

新建文章时默认填当前北京时间，可以在新建窗口里改，也可以清空。

已有笔记可以执行命令「设置发布时间」，或者在文件列表/编辑器里右键。弹出的
时间框按北京时间算，点「清除」只删掉笔记里的 `publishedAt`，不会改博客上已有的
发布时间。

发布时间会写进 frontmatter：

```yaml
publishedAt: 2026-11-21T14:30:00+08:00
```

发布时插件会把这个时间一起提交。不能晚于当前时间，否则博客会拒绝发布。插件里
显示的时间，比如文章列表里的更新时间，也都按北京时间算。

### 分类和标签

分类只能一个，标签可以多个。

新建文章时可以点「选择…」打开分类和标签窗口。窗口会读云端已有的分类和标签：

- 分类输入框带候选，点一下就能选已有的
- 标签可以搜索，点标签就能加上或去掉
- 也可以直接输入云端没有的名字

已有笔记执行命令「设置分类和标签」，或者在文件列表/编辑器里右键，也能改。
保存时会写进 frontmatter：

```yaml
category: 随笔
tags:
  - Obsidian
  - 博客
```

云端没有的分类或标签，会在发布或存草稿时自动创建。前提是设置里的
「自动创建分类和标签」开着，默认是开的。

### 拉取云端文章

点左侧栏的下载图标，或状态栏菜单「拉取文章…」。可以搜标题或 slug，点一篇就拉下来。

默认目录：

```text
FlareStackBlog/
└── hello-world/
    └── Hello World.md
```

- 每篇一个独立文件夹
- 分类和标签会一起写进 frontmatter
- 本地已有同一篇时，会问你是打开本地还是用云端覆盖
- 正文里的 `/images/...` 和站内链接会换成完整博客地址，图片在 Obsidian 里能直接看
- 图片不会下载到本地，还是用博客媒体库
- 拉下来的笔记带 `fsb_post_id`，改完直接发布就是更新同一篇

## Frontmatter

插件认这些字段，都是可选的：

```yaml
---
title: 文章标题
summary: 摘要
slug: custom-url-slug
tags:
  - Obsidian
  - 博客
category: 随笔
cover: attachments/cover.png
---
```

| 字段 | 说明 |
| --- | --- |
| `title` | 不填就用文件名 |
| `summary` / `description` | 摘要 |
| `slug` | 文章地址，例如 `/post/<slug>`；不填由博客生成 |
| `tags` / `tag` | 标签，可以多个；数组或逗号分隔 |
| `category` | 分类，只能一个 |
| `categories` | 旧字段，只取第一个；新笔记请用 `category` |
| `cover` / `cover_image` / `image` | 封面，本地图片路径或 `![[图片]]` |
| `publishedAt` | 发布时间，例如 `2026-11-21T14:30:00+08:00`；不填由博客在发布时决定 |

发布后插件会写入：

```yaml
fsb_post_id: 123
fsb_url: https://blog.example.com/post/example
fsb_updated_at: 2026-01-01T00:00:00+08:00
```

`fsb_post_id` 别手动改，不然可能更新到别的文章。文章在博客后台删了的话，
删掉这个字段再重新发布。

## 图片

- 支持 `![[image.png]]`、`![[image.png|alt]]` 和 `![alt](attachments/image.png)`
- png、jpg/jpeg、webp、gif、svg，单张最大 10 MB
- 上传后正文里会换成 `/images/...`
- 上传失败的图片会中止发布，免得服务端报 400
- 网络图片和已经是 `/images/...` 的地址不会重复上传
- 关掉「上传本地图片」后，正文里的本地路径会被服务端拒绝
- 封面只支持本地图片，网络封面会保留原封面
- 代码块和行内代码里的图片语法不会处理

打开「UUID 文件名」后，云端文件名会变成
`3c9a1f7e-5b2d-4a8c-9e6f-1d4b7a2c8e90.png` 这种。名字是根据图片内容算的，
同一张图重复发布会复用同一个文件。只改云端名字，本地文件不动。

之前用原文件名传过的图片，第一次开这个选项会再传一份 UUID 名字的副本，
旧的可以在媒体库清理。

## 双链

- `[[笔记]]` → 指向那篇已发布文章的链接
- `[[笔记|别名]]` → 用别名当链接文字
- `[[笔记#标题]]` → 带标题锚点
- 目标笔记没发布时，会变成纯文本并提示
- `![[笔记]]` 这种笔记嵌入不会转
- 代码块和行内代码里的双链不会动

## 注意

- Flare Stack Blog 会把 H1 降成 H2，正文标题建议从 H2 开始
- 脚注、任务列表、原始 HTML 会变成纯文本
- 改已发布文章的 `slug` 会换 URL，旧地址不会跳转
- 发布时间不能晚于当前时间
- 如果还部署了静态镜像，发布后要重新构建镜像
- 插件只管文章，不管动态、评论、友链和站点设置
- 插件里显示的时间统一按北京时间（UTC+8）

## 开发

```bash
npm install
npm run dev     # 监听并生成 main.js
npm run check   # 类型检查
npm run build   # 类型检查 + 构建
```

发新版：

1. 改 `package.json`、`manifest.json`、`versions.json` 里的版本号
2. `git tag 0.2.0 && git push origin 0.2.0`
3. Actions 会建 Release

## License

[MIT](LICENSE)
