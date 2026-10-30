const fs = require('fs');
const path = require('path');
const { s2tw, tw2s } = require('../../cross-strait-localization/scripts/convert_text.js');
const { renderMarkdownToHtmlFile } = require('./render_rich_text_html.js');
const { createVideoScriptContent } = require('./generate_video_script.js');

function findRepoRoot(startDir) {
  let cur = startDir;
  while (cur && path.dirname(cur) !== cur) {
    if (fs.existsSync(path.join(cur, '_posts')) || fs.existsSync(path.join(cur, '.git'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return path.resolve(startDir, '../../../..');
}

function parsePostFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: content };
  }

  const rawMeta = match[1];
  const body = match[2];
  const metadata = {};

  rawMeta.split(/\r?\n/).forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      metadata[key] = val;
    }
  });

  return { metadata, body };
}

function generateSocialPackage(postFilePath, customFolderName) {
  const repoRoot = findRepoRoot(__dirname);
  const fullPostPath = path.isAbsolute(postFilePath) ? postFilePath : path.resolve(repoRoot, postFilePath);

  if (!fs.existsSync(fullPostPath)) {
    throw new Error(`找不到文章檔案: ${fullPostPath}`);
  }

  const fileContent = fs.readFileSync(fullPostPath, 'utf8');
  const fileName = path.basename(fullPostPath, '.md');
  const { metadata, body: rawBody } = parsePostFrontmatter(fileContent);

  // Clean Jekyll liquid relative_url and leading H1 if duplicated
  const body = rawBody
    .replace(/^\s*#\s+[^\r\n]+\r?\n+/, '')
    .replace(/\{\{\s*['"]\/post\/([^'"]+)['"]\s*\|\s*relative_url\s*\}\}/g, 'https://coachsunny.github.io/blog/post/$1');

  // Extract date and slug
  const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/);
  const postDate = metadata.date || (dateMatch ? dateMatch[1] : '2026-10-29');
  const postSlug = dateMatch ? dateMatch[2] : fileName;
  const postTitle = metadata.title || fileName;

  const permalink = `https://coachsunny.github.io/blog/post/${postSlug}/`;
  const blogHome = `https://coachsunny.github.io/blog/`;

  // Localized Traditional Chinese Body & Title
  const titleTc = s2tw(postTitle);
  const bodyTc = s2tw(body);

  // Simplified Body & Title
  const titleSc = tw2s(postTitle);
  const bodySc = tw2s(body);

  // Folder name in social_posts/: YYYY-MM-DD_主題名
  const safeTitle = titleTc.split(/[:：\s]/)[0].replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '');
  const folderName = customFolderName || `${postDate}_${safeTitle}`;
  const targetDir = path.join(repoRoot, 'social_posts', folderName);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`\n📦 開始為《${postTitle}》建立 12 項社群分發資產...`);
  console.log(`📁 目標目錄: ${targetDir}`);
  console.log(`🔗 永久連結: ${permalink}\n`);

  // 1. 04_方格子 (100% Traditional Chinese with Taiwan vocabulary & bio)
  const fanggeziFooter = `

---

### 關於作者｜Sunny

ICF 國際教練聯盟認證專業教練（ACC）。專注於深層自我覺察、領導力溝通與內在思維模型轉化。深信「外在的對話困局，本質都是內在心智的投射」。

☕ 完整收錄於個人專欄：[心茶記 Mind Tea Journal](${blogHome})  
📖 閱讀本篇原文：[${titleTc}](${permalink})  
📬 歡迎加入教練讀者交流（微信與 LINE 個人聯繫方式請見專欄首頁），開啟專屬於你的心智探索之旅。
`;
  const fanggeziMd = `# ${titleTc}\n\n${bodyTc.trim()}${fanggeziFooter}`;
  fs.writeFileSync(path.join(targetDir, '04_方格子.md'), fanggeziMd, 'utf8');
  fs.writeFileSync(path.join(targetDir, '04_方格子.txt'), fanggeziMd, 'utf8');
  renderMarkdownToHtmlFile(fanggeziMd, path.join(targetDir, '04_方格子_富文本預覽.html'), titleTc, 'zh-TW');

  // 2. 07_知乎 (Simplified Chinese for Mainland high-depth readers)
  const zhihuFooter = `

---

### 关于作者｜Sunny

ICF 国际教练联盟认证专业教练（ACC）。专注于深层自我觉察、领导力沟通与内在思维模型转化。深信“外在的对话困局，本质都是内在心智的投射”。

☕ 完整深度长文收录于个人专栏：[心茶记 Mind Tea Journal](${blogHome})  
📖 阅读本篇原文：[${titleSc}](${permalink})  
📬 欢迎加入读者交流（个人联系微信见专栏首页），开启属于你的心智探索之旅。
`;
  const zhihuMd = `# ${titleSc}\n\n${bodySc.trim()}${zhihuFooter}`;
  fs.writeFileSync(path.join(targetDir, '07_知乎.md'), zhihuMd, 'utf8');
  fs.writeFileSync(path.join(targetDir, '07_知乎.txt'), zhihuMd, 'utf8');
  renderMarkdownToHtmlFile(zhihuMd, path.join(targetDir, '07_知乎_富文本預覽.html'), titleSc, 'zh-CN');

  // Extract a few lead paragraphs for hooks
  const paragraphsTc = bodyTc.split(/\r?\n\r?\n/).filter(p => !p.startsWith('#') && p.trim().length > 20);
  const leadParagraphTc = paragraphsTc[0] || '';
  const secondParagraphTc = paragraphsTc[1] || '';

  // 3. 01_Facebook.txt (Heartfelt story narrative, Traditional Chinese)
  const fbContent = `【心茶記 · 晨光微光】${titleTc}

${leadParagraphTc}

${secondParagraphTc}

☕ 喝一杯溫暖的茶，給心靈留白五分鐘。
深層反思與完整長文收錄於專欄：
👉 點擊閱讀全文：${permalink}

#心茶記 #自我覺察 #ICF教練 #正念生活 #深層溝通
`;
  fs.writeFileSync(path.join(targetDir, '01_Facebook.txt'), fbContent, 'utf8');

  // 4. 02_LinkedIn.txt (Leadership, psychological safety, Traditional Chinese)
  const liContent = `【領導力與職場心智】${titleTc}

在複雜多變的組織環境中，溝通的品質直接決定了團隊的心理安全感與執行力。

${leadParagraphTc}

當我們能夠超越表層的立場防禦，回到深層的覺察與傾聽時，對話才能真正轉化為彼此賦能的契機。

🔗 閱讀專欄完整深度解析：${permalink}

#領導力溝通 #心理安全感 #教練領導力 #自我覺察 #MindTeaJournal
`;
  fs.writeFileSync(path.join(targetDir, '02_LinkedIn.txt'), liContent, 'utf8');

  // 5. 03_Threads.txt (Punchy short quotes, wide spacing, Traditional Chinese)
  const threadsContent = `「${titleTc.split(/[:：]/)[0]}」
.
${leadParagraphTc.slice(0, 120)}...
.
有時候，慢下來不是耽擱，
而是為了讓靈魂跟上說話的腳步。
.
給自己留白三秒鐘，
鬆開肩膀，好好聽，好好說。☕
.
📖 完整長文：${permalink}
`;
  fs.writeFileSync(path.join(targetDir, '03_Threads.txt'), threadsContent, 'utf8');

  // 6. 05_微信朋友圈與群.txt (Simplified Chinese, warm morning greeting & coaching question)
  const wechatContent = `【晨光微光 · 心茶记】

早上好 ☕

${tw2s(leadParagraphTc).slice(0, 140)}...

今日教练微思考：
“在今天即将开启的对话里，你是否愿意先慢下半拍，确认彼此眼神里的温度？”

愿我们在喧嚣里，保有心中的宁静与澄澈 🌿
📖 深度长文阅读：${permalink}
`;
  fs.writeFileSync(path.join(targetDir, '05_微信朋友圈與群.txt'), wechatContent, 'utf8');

  // 7. 06_小紅書.txt (Pain point, emoji, ZERO external URLs, search guidance)
  const xhsTitle = `为什么我们总是很难好好说话？🌿｜心茶记`;
  const xhsContent = `${xhsTitle}

${tw2s(leadParagraphTc).slice(0, 100)}...

⚠️ 阻碍沟通的 3 个隐形暗坑：
1️⃣ 习惯用评判代替好奇
2️⃣ 身体疲惫时情绪本能防御
3️⃣ 忽略了场域与媒介的温度

💡 教练的「微步反思心法」：
✨ 说话前深呼吸一次，松开咬紧的牙关
✨ 区分对方的“情绪暴雨”与“客观事实”
✨ 用好奇提问替代反唇相讥

慢慢说，慢慢听，慢慢看见。☕

---
🔍 完整深度长文收录于个人专栏《心茶记》（浏览器搜索「心茶记 Sunny」即可阅读全篇 ☕）
`;
  fs.writeFileSync(path.join(targetDir, '06_小紅書.txt'), xhsContent, 'utf8');

  // 8. 08_短視頻腳本.txt (30-second Short Video Script based on 5 Archetypes)
  const videoScriptPath = path.join(targetDir, '08_短視頻腳本.txt');
  if (!fs.existsSync(videoScriptPath)) {
    const videoScript = createVideoScriptContent(titleTc, bodyTc, postSlug);
    fs.writeFileSync(videoScriptPath, videoScript, 'utf8');
  }

  // Check cover image
  const coverTarget = path.join(targetDir, 'cover.jpg');
  if (!fs.existsSync(coverTarget)) {
    console.log(`⚠️  提醒: 目前目錄尚未生成 cover.jpg，請使用 zen-cover-designer 技能生成並歸檔封面。`);
  }

  console.log(`✅ 13 項社群與短影音資產產製完成！`);

  // Run linter on this folder
  console.log(`\n🔍 正在執行發布前 Linter 檢驗...`);
  const { execSync } = require('child_process');
  const linterScript = path.join(repoRoot, '.agents/skills/cross-strait-localization/scripts/lint_social_posts.js');
  try {
    const lintOutput = execSync(`node "${linterScript}" "${targetDir}"`, { encoding: 'utf8' });
    console.log(lintOutput);
  } catch (err) {
    console.warn(`⚠️ Linter 回報提醒或錯誤:\n`, err.stdout || err.message);
  }

  return targetDir;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const repoRoot = findRepoRoot(__dirname);

  let postPath = null;
  let customFolder = null;
  if (args.length > 0) {
    postPath = args[0];
    customFolder = args[1] || null;
  } else {
    // Find latest post in _posts
    const postsDir = path.join(repoRoot, '_posts');
    const posts = fs.readdirSync(postsDir).filter(f => f.endsWith('.md')).sort().reverse();
    if (posts.length > 0) {
      postPath = path.join(postsDir, posts[0]);
      console.log(`未指定檔案，預設選取最新文章: ${posts[0]}`);
    }
  }

  if (postPath) {
    try {
      generateSocialPackage(postPath, customFolder);
    } catch (e) {
      console.error('❌ 生成失敗:', e.message);
      process.exit(1);
    }
  }
}

module.exports = {
  generateSocialPackage
};
