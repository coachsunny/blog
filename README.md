# 心茶记 · Jekyll 博客

一个温暖、安静的心理探索博客，基于 Jekyll 构建，部署到 GitHub Pages 即可使用。

**最大的好处：写文章只需要新建一个 Markdown 文件，首页文章列表自动更新，不用手动改主页！**

---

## 📁 文件结构

```
xinchaji-jekyll/
├── _config.yml              # 站点配置（标题、作者、导航等）
├── _layouts/                # 页面布局模板
│   ├── default.html         # 默认布局（导航+页脚）
│   └── post.html            # 文章详情页布局
├── _posts/                  # 所有文章都在这里（Markdown 格式）
│   ├── 2026-07-28-pattern-repetition.md
│   ├── 2026-07-15-power-of-awareness.md
│   └── 2026-06-30-emotions-are-not-enemies.md
├── index.html               # 主页（自动生成文章列表）
├── about.md                 # 关于页
├── css/
│   └── style.css            # 样式表
├── js/
│   └── main.js              # 交互脚本
├── Gemfile                  # 本地预览用（GitHub Pages 不需要）
└── README.md                # 本文件
```

---

## 🚀 部署到 GitHub Pages

### 方法一：通过网页上传（最简单，推荐新手）

1. 登录 GitHub，点击右上角 **+** → **New repository**
2. 仓库名建议：`blog` 或 `xinchaji`
3. 选择 **Public**（公开仓库才能免费使用 GitHub Pages）
4. 点击 **Create repository**
5. 在仓库页面，点击 **uploading an existing file**
6. 把本文件夹里的**所有文件和文件夹**拖进去（注意：要连 `_posts`、`_layouts` 这些文件夹一起上传）
7. 点击 **Commit changes**
8. 进入仓库的 **Settings** → **Pages**
9. 在 **Source** 里选择：
   - Branch: `main`
   - Folder: `/ (root)`
10. 点击 **Save**
11. 等 1-3 分钟，页面上方会显示你的博客网址：
    `https://你的用户名.github.io/仓库名/`

> 💡 **注意**：第一次构建可能需要等几分钟，刷新页面就能看到了。

### 方法二：通过 Git 命令行

```bash
# 1. 进入博客文件夹
cd xinchaji-jekyll

# 2. 初始化 Git
git init
git add .
git commit -m "初始提交：心茶记 Jekyll 博客"

# 3. 关联远程仓库（替换为你自己的仓库地址）
git remote add origin https://github.com/你的用户名/仓库名.git
git branch -M main
git push -u origin main

# 4. 在 GitHub 仓库 Settings → Pages 中开启 Pages 服务
```

---

## ✍️ 如何添加新文章（超简单！）

### 最佳工作流程（推荐）

**你写纯文字 → 我帮你转成 Markdown → 你推送上去**

这样你完全不用学任何语法，专心写内容就好。

每次有新文章，你只要：
1. 把文章的纯文字内容发给我
2. 告诉我标题、标签、日期（不说的话我帮你定）
3. 我帮你生成好 Markdown 文件
4. 你把文件放到 `_posts/` 文件夹，推到 GitHub 就行

### 自己写的话也很简单

如果你想自己写，只需要两步：

#### 步骤 1：在 `_posts/` 文件夹新建文件

文件名格式必须是：`YYYY-MM-DD-文章英文标识.md`

例如：`2026-08-06-my-new-article.md`

#### 步骤 2：按格式写内容

每篇文章开头要有一段「元信息」（Front Matter），然后是正文：

```markdown
---
layout: post
title: 你的文章标题
date: 2026-08-06
tags: [标签1, 标签2, 标签3]
read_time: 8
description: 文章的一句话摘要，会显示在首页卡片上
---

这里是正文内容，直接用 Markdown 写就行。

## 小标题

正文段落……

> 引用的内容

**加粗的文字**
```

#### 支持的 Markdown 语法

| 语法 | 效果 |
|------|------|
| `## 标题` | 二级标题 |
| `**加粗**` | **加粗文字** |
| `> 引用` | 引用块 |
| `- 列表项` | 无序列表 |
| `1. 列表项` | 有序列表 |
| `[链接文字](网址)` | 超链接 |

---

## 🎨 自定义修改

### 修改博客名称、作者、邮箱

打开 `_config.yml`，修改对应的字段：

```yaml
title: 心茶记           # 博客名
tagline: 一杯安静的时光  # 副标题
author: 林安            # 作者名
email: hello@xinchaji.com  # 联系邮箱
```

改完保存，推送上去就自动更新了。

### 修改配色

打开 `css/style.css`，修改 `:root` 里的颜色变量：

```css
:root {
  --primary: hsl(145, 22%, 42%);  /* 主色调：鼠尾草绿 */
  --bg: hsl(40, 30%, 96%);        /* 背景色：暖米色 */
  --text: hsl(28, 25%, 22%);      /* 文字色：深棕色 */
}
```

### 修改头像

打开 `about.md`，找到头像的 `<img>` 标签，把 `src` 改成你的头像图片地址。

### 修改导航菜单

打开 `_config.yml`，修改 `nav` 部分：

```yaml
nav:
  - title: 首页
    url: /
  - title: 文章
    url: /#articles
  - title: 关于
    url: /about/
```

---

## 🔧 本地预览（可选）

如果你想在本地预览效果再推送，可以安装 Jekyll：

```bash
# 安装依赖（需要先安装 Ruby）
bundle install

# 启动本地服务器
bundle exec jekyll serve

# 打开浏览器访问 http://localhost:4000
```

> 💡 不装也没关系，直接推到 GitHub Pages 一样能看，只是要等几分钟构建。

---

## 📝 常见问题

**Q: 推送了新文章，首页没更新？**
A: GitHub Pages 构建需要 1-3 分钟，等一会儿刷新试试。如果还是没更新，清除浏览器缓存（Ctrl+F5）。

**Q: 文章顺序是怎么排的？**
A: 按日期倒序排列，最新的在最上面。日期由文件名里的 `YYYY-MM-DD` 决定。

**Q: 可以放图片吗？**
A: 可以。把图片放到 `assets/` 文件夹，然后在文章里用 `![图片描述](/assets/图片名.jpg)` 引用就行。

**Q: 标签有什么用？**
A: 目前标签显示在文章卡片和文章顶部。以后如果需要，可以加标签归档页。

---

## 💡 小贴士

- 每次写完文章，发给我帮你转成 Markdown 是最快的方式
- 文件名里的日期决定了文章的排序，想让某篇文章置顶就把日期设晚一点
- `description` 字段很重要，它会显示在首页卡片上，也会用于搜索引擎
- 如果想改风格、加功能，随时告诉我就好 😊
