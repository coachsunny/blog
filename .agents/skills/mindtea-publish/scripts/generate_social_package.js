const fs = require('fs');
const path = require('path');
const { s2tw, tw2s } = require('../../cross-strait-localization/scripts/convert_text.js');
const { renderMarkdownToHtmlFile } = require('./render_rich_text_html.js');
const { createVideoScriptContent } = require('./generate_video_script.js');
const { renderAllMermaidFromPost } = require('./render_mermaid_images.js');

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

function cleanMarkdownForSocial(md) {
  if (!md) return '';
  // Convert <div class="coaching-box"> or <div class="reflection-box"> into native Markdown blockquotes
  let cleaned = md.replace(/<div\s+class=["'](?:coaching|reflection)-box["']>([\s\S]*?)<\/div>/gi, (match, inner) => {
    let text = inner
      .replace(/<\/?p>/gi, '')
      .replace(/<\/?ol>/gi, '')
      .replace(/<\/?ul>/gi, '')
      .trim();

    let liIdx = 1;
    text = text.replace(/<li>([\s\S]*?)<\/li>/gi, (m, liContent) => {
      return `${liIdx++}. ${liContent.trim()}\n`;
    });

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    return lines.map(l => `> ${l}`).join('\n>\n');
  });

  // Strip any remaining unclosed or stray div tags
  cleaned = cleaned.replace(/<\/?div\b[^>]*>/gi, '');

  return cleaned;
}

function generateSocialPackage(postFilePath, customFolderName) {
  const repoRoot = findRepoRoot(__dirname);
  const fullPostPath = path.isAbsolute(postFilePath) ? postFilePath : path.resolve(repoRoot, postFilePath);

  if (!fs.existsSync(fullPostPath)) {
    throw new Error(`找不到文章檔案: ${fullPostPath}`);
  }

  let fileContent = fs.readFileSync(fullPostPath, 'utf8');
  // Auto-clean _posts/ with OpenCC tw2s if any traditional characters are present (for Chinese posts)
  if (!fullPostPath.endsWith('-en.md')) {
    const sanitizedContent = tw2s(fileContent);
    if (fileContent !== sanitizedContent) {
      fs.writeFileSync(fullPostPath, sanitizedContent, 'utf8');
      console.log(`🧹 [OpenCC 自動清洗] 偵測到 ${path.basename(fullPostPath)} 含有未轉譯繁體字，已由 OpenCC tw2s 自動清洗為 100% 簡體中文！`);
      fileContent = sanitizedContent;
    }
  }

  const fileName = path.basename(fullPostPath, '.md');
  const { metadata, body: rawBody } = parsePostFrontmatter(fileContent);

  // Clean Jekyll liquid relative_url and leading H1 if duplicated
  const body = rawBody
    .replace(/^\s*#\s+[^\r\n]+\r?\n+/, '')
    .replace(/\{\{\s*['"]\/post\/([^'"]+)['"]\s*\|\s*relative_url\s*\}\}/g, 'https://blog.portal-coachsunny.com/post/$1');

  // Extract date and slug
  const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/);
  const postDate = metadata.date || (dateMatch ? dateMatch[1] : '2026-10-29');
  const postSlug = dateMatch ? dateMatch[2] : fileName;
  const postTitle = metadata.title || fileName;

  const permalink = `https://blog.portal-coachsunny.com/post/${postSlug}/`;
  const blogHome = `https://blog.portal-coachsunny.com/`;

  // Localized Traditional Chinese Body & Title (clean for syndication)
  const titleTc = s2tw(postTitle);
  const bodyTc = cleanMarkdownForSocial(s2tw(body));

  // Simplified Body & Title (clean for syndication)
  const titleSc = tw2s(postTitle);
  const bodySc = cleanMarkdownForSocial(tw2s(body));

  // Folder name in social_posts/: YYYY-MM-DD_主題名 (reuse existing folder if present)
  const safeTitle = titleTc.split(/[:：\s]/)[0].replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '');
  let folderName = customFolderName;
  if (!folderName) {
    const socialPostsBase = path.join(repoRoot, 'social_posts');
    if (fs.existsSync(socialPostsBase)) {
      const existingFolders = fs.readdirSync(socialPostsBase).filter(f => f.startsWith(`${postDate}_`));
      if (existingFolders.length === 1) {
        folderName = existingFolders[0];
      } else if (existingFolders.length > 1) {
        // Try finding one that matches safeTitle substring
        const match = existingFolders.find(f => f.includes(safeTitle.slice(0, 3)));
        if (match) folderName = match;
      }
    }
    if (!folderName) {
      folderName = `${postDate}_${safeTitle}`;
    }
  }
  const targetDir = path.join(repoRoot, 'social_posts', folderName);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 0. Auto-render all Mermaid flowcharts into high-DPI Zen Tea infographic PNG images
  try {
    renderAllMermaidFromPost(fullPostPath, targetDir, true);
  } catch (err) {
    console.warn('⚠️ 流程圖圖片產製略過或失敗:', err.message);
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
  renderMarkdownToHtmlFile(fanggeziMd, path.join(targetDir, '04_方格子_富文本預覽.html'), titleTc, 'zh-TW', postSlug);

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
  renderMarkdownToHtmlFile(zhihuMd, path.join(targetDir, '07_知乎_富文本預覽.html'), titleSc, 'zh-CN', postSlug);

  // Strip code blocks and mermaid diagrams for clean text extraction
  const cleanBodySc = bodySc.replace(/```[\s\S]*?```/g, '');
  const cleanBodyTc = bodyTc.replace(/```[\s\S]*?```/g, '');

  // Extract a few lead paragraphs for hooks
  const paragraphsTc = cleanBodyTc.split(/\r?\n\r?\n/).filter(p => !p.startsWith('#') && p.trim().length > 20);
  const leadParagraphTc = paragraphsTc[0] || '';
  const secondParagraphTc = paragraphsTc[1] || '';

  const paragraphsSc = cleanBodySc.split(/\r?\n\r?\n/).filter(p => !p.startsWith('#') && p.trim().length > 20);
  const leadParagraphSc = paragraphsSc[0] || '';
  const secondParagraphSc = paragraphsSc[1] || '';

  // Extract core takeaways, blockquotes, and ending punchline
  const blockquoteLinesSc = Array.from(cleanBodySc.matchAll(/>\s*([^\r\n]+)/g))
    .map(m => m[1].replace(/^[>\s*`_“"']+|[*\s`_”"']+$/g, '').trim())
    .filter(q => q.length > 5 && !q.startsWith('http') && !q.includes('-->') && !q.includes('本文为') && !q.includes('本文為'));

  // Find pure coaching questions (under coaching inquiries section)
  const questionCandidatesSc = blockquoteLinesSc
    .filter(q => (q.includes('？') || q.includes('?')) && !q.includes('心茶记') && !q.includes('提问'))
    .map(q => q.replace(/^\d+[\.、]\s*/, '').replace(/^[^：:]+[：:]\s*/, '').replace(/^[“”"']+|[“”"']+$/g, '').trim());

  let questionMatchSc = questionCandidatesSc[0] || '面对当下的选择，如果换一个视角，你会怎么看待现在的自己？';
  let questionMatchTc = s2tw(questionMatchSc);

  // Ending quote: look at blockquotes at the bottom of the article (after the coaching questions)
  const nonQuestionQuotesSc = blockquoteLinesSc.filter(q => 
    !q.includes('？') && !q.includes('?') && !q.includes('心茶记') && !q.includes('提问') && !q.includes('教练') && q.length > 10
  );

  let endingQuoteSc = nonQuestionQuotesSc[nonQuestionQuotesSc.length - 1] || '愿我们在喧嚣里，保有心中的宁静与澄澈。';
  endingQuoteSc = endingQuoteSc.replace(/^[>\s*`_“"']+|[*\s`_”"']+$/g, '').trim();
  const endingQuoteTc = s2tw(endingQuoteSc);

  // Extract core framework points (supports ## 开关 / ## 齿轮 / ## 阶段 / * **步骤 1【...】**)
  let stepHeadingsSc = [];
  
  // Try matching ## 开关一 / ## 齿轮四 / ## 一、 ...
  const h2Matches = Array.from(cleanBodySc.matchAll(/##\s+(?:开关|齿轮|关键|阶段|步骤)?[一二三四五六七八九十\d]+[：:、. ]\s*([^\r\n]+)/gi))
    .map(m => m[1].replace(/[*_`]/g, '').trim());
  if (h2Matches.length > 0) {
    stepHeadingsSc = h2Matches;
  } else {
    // Try matching * **步骤 1【...】**
    const stepMatches = Array.from(cleanBodySc.matchAll(/\*\*\s*步骤\s*\d+【([^】]+)】\s*\*\*/gi))
      .map(m => m[1].trim());
    if (stepMatches.length > 0) {
      stepHeadingsSc = stepMatches;
    } else {
      // General ## headings
      stepHeadingsSc = Array.from(cleanBodySc.matchAll(/##\s+([^\r\n]+)/g))
        .map(m => m[1].replace(/[*_`]/g, '').trim())
        .filter(h => !h.includes('提问') && !h.includes('实验') && !h.includes('关于作者'));
    }
  }

  // Parse tags
  let rawTags = metadata.tags || [];
  if (typeof rawTags === 'string') {
    rawTags = rawTags.replace(/[\[\]'"]/g, '').split(',').map(t => t.trim()).filter(Boolean);
  }
  const tagsSc = rawTags.map(t => tw2s(t));
  const tagsTc = rawTags.map(t => s2tw(t));

  // 3. 01_Facebook.txt (Heartfelt story narrative, Traditional Chinese)
  const fbContent = `【心茶記 · 晨光微光】${titleTc}

${leadParagraphTc}

${secondParagraphTc}

☕ 喝一杯溫暖的茶，給心靈留白五分鐘。
「${endingQuoteTc}」

深層反思與完整長文收錄於專欄：
👉 點擊閱讀全文：${permalink}

#心茶記 #自我覺察 #ICF教練 #正念生活 #溝通心理學
`;
  fs.writeFileSync(path.join(targetDir, '01_Facebook.txt'), fbContent, 'utf8');

  // 4. 02_LinkedIn.txt (Leadership, psychological safety, Traditional Chinese)
  const liContent = `【領導力與職場心智】${titleTc}

在複雜多變的組織環境中，溝通的品質直接決定了團隊的心理安全感與執行力。

${leadParagraphTc}

${secondParagraphTc}

當我們能夠超越表層的立場防禦，回到深層的覺察與傾聽時，對話才能真正轉化為彼此賦能的契機。
「${endingQuoteTc}」

🔗 閱讀專欄完整深度解析：${permalink}

#領導力溝通 #心理安全感 #教練領導力 #自我覺察 #MindTeaJournal
`;
  fs.writeFileSync(path.join(targetDir, '02_LinkedIn.txt'), liContent, 'utf8');

  // 5. 03_Threads.txt (Punchy short quotes, wide spacing, Traditional Chinese)
  const threadsContent = `「${titleTc.split(/[:：]/)[0]}」
.
${leadParagraphTc.slice(0, 110)}...
.
有時候，慢下來不是耽擱，
而是為了讓靈魂跟上說話的腳步。
.
「${endingQuoteTc}」
.
給自己留白三秒鐘，
鬆開肩膀，好好聽，好好說。☕
.
📖 完整長文：${permalink}
`;
  fs.writeFileSync(path.join(targetDir, '03_Threads.txt'), threadsContent, 'utf8');

  // 6. 05_微信朋友圈與群.txt (Simplified Chinese, single best-in-class version)
  const wechatContent = `【晨光微光 · 心茶记】

${leadParagraphSc}

${secondParagraphSc ? secondParagraphSc + '\n\n' : ''}☕ 今日教练微思考：
“${questionMatchSc}”

${endingQuoteSc} 🌿
📖 深度长文阅读：${permalink}
`;
  fs.writeFileSync(path.join(targetDir, '05_微信朋友圈與群.txt'), wechatContent, 'utf8');

  // 7. 06_小紅書.txt (Pain point, emoji, ZERO external URLs, search guidance, 3+2 tags)
  const xhsTitle = `${titleSc.split(/[:：]/)[0]}🌿｜心茶记`;
  
  let keyPointsText = '';
  if (stepHeadingsSc.length > 0) {
    keyPointsText = stepHeadingsSc.slice(0, 3).map((h, i) => `${i + 1}️⃣【${h}】`).join('\n');
  } else {
    keyPointsText = `1️⃣ 自我觉察：看见行为背后的真实需求\n2️⃣ 认知重塑：放下预设退路，收回拥有权\n3️⃣ 踏实微步：小到不可能失败的自律循环`;
  }

  // 3 specific context tags + 2 domain brand tags
  const specificTags = tagsSc.filter(t => !['心茶记', '心理学', 'ICF教练'].includes(t)).slice(0, 3);
  while (specificTags.length < 3) {
    specificTags.push('自我成长');
  }
  const xhsTagsFormatted = `#${specificTags.join(' #')} #心理学 #心茶记`;

  const xhsContent = `${xhsTitle}

${leadParagraphSc}

${secondParagraphSc ? secondParagraphSc + '\n\n' : ''}💡 核心启示与破局关键：
${keyPointsText}

☕ 今日教练微思考：
“${questionMatchSc}”

${endingQuoteSc} 🌿

---
🔍 完整深度长文收录于个人专栏《心茶记》（浏览器搜索「心茶记 教练」即可阅读全篇 ☕）

${xhsTagsFormatted}
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
