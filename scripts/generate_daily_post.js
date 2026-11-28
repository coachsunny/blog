/**
 * 心茶記 (Mind Tea Journal) · 全自動每日專欄產製腳本
 * 當晨間排程發現當日尚未有新文章時，自動執行：
 * 1. 盤點近 30 天主題（防重複）與近期教練反饋
 * 2. 依六大開頭模型輪替，調用 Gemini 2.5 Flash 撰寫中英雙語專欄（含茶禪思維對比卡）
 * 3. 生成/選取東方茶禪封面圖並歸檔
 * 4. 產製 13 項社群資產與 9:16 短影音
 * 5. 執行兩岸繁簡 Linter 與全站 QA 稽核
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadEnv, callGemini } = require('./telegram_bot');

loadEnv();

const ROOT_DIR = path.resolve(__dirname, '..');

function getTodayString() {
  const now = new Date();
  const twDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const y = twDate.getFullYear();
  const m = String(twDate.getMonth() + 1).padStart(2, '0');
  const d = String(twDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRecentPostsSummary(days = 30) {
  const postsDir = path.join(ROOT_DIR, '_posts');
  if (!fs.existsSync(postsDir)) return [];
  const files = fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md') && !f.endsWith('-en.md'))
    .sort()
    .reverse()
    .slice(0, days);

  return files.map(file => {
    const content = fs.readFileSync(path.join(postsDir, file), 'utf8');
    const titleMatch = content.match(/title:\s*["']?([^"'\r\n]+)["']?/);
    return {
      file,
      title: titleMatch ? titleMatch[1] : file
    };
  });
}

function getRecentCoachFeedback(limit = 8) {
  const logPath = path.join(ROOT_DIR, '_drafts', 'coach_feedback.jsonl');
  if (!fs.existsSync(logPath)) return [];
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map(l => {
    try {
      return JSON.parse(l).coachText;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

const OPENING_MODELS = [
  '模型 1：現場微對話 / 留白切入（以真實教練或生活對話開場，不說教）',
  '模型 2：畫面定格 / 感官白描切入（聚焦光影、氣味、身體微動作）',
  '模型 3：反直覺觀點 / 認知翻轉切入（打破常見迷思，提出深刻心理機制）',
  '模型 4：客觀現象白描 / 人類心智觀察（以第三人稱觀察普遍心理慣性）',
  '模型 5：哲人思想 / 詩意隱喻切入（以自然茶禪意象隱喻心理狀態）',
  '模型 6：身心覺受 / 落地共振切入（從胸口、呼吸、肩膀緊繃等身體訊號切入）'
];

async function generateCoverImage(prompt, destPath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: `${prompt}, 16:9 widescreen, no text, no watermarks, no logos, no humans` }],
          parameters: { sampleCount: 1, aspectRatio: '16:9' }
        }),
        signal: AbortSignal.timeout(45000)
      });
      if (res.ok) {
        const data = await res.json();
        const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
        if (b64) {
          fs.writeFileSync(destPath, Buffer.from(b64, 'base64'));
          console.log('✅ 已透過 Imagen 3.0 生成專屬東方茶禪封面');
          return destPath;
        }
      }
    } catch (e) {
      console.warn('⚠️ Imagen 生成略過，改採備援茶禪意象圖:', e.message);
    }
  }

  // Fallback: copy from assets/default_scenes/
  const defaultDir = path.join(ROOT_DIR, 'assets', 'default_scenes');
  if (fs.existsSync(defaultDir)) {
    const imgs = fs.readdirSync(defaultDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    if (imgs.length > 0) {
      const pick = imgs[new Date().getDate() % imgs.length];
      fs.copyFileSync(path.join(defaultDir, pick), destPath);
      console.log(`✅ 已使用備援東方茶禪封面: ${pick}`);
      return destPath;
    }
  }
  return null;
}

async function generateDailyPost(options = {}) {
  const dateStr = options.date || getTodayString();
  const dryRun = Boolean(options.dryRun);

  console.log(`\n=== 開始全自動產製 ${dateStr} 專欄文章 (dryRun=${dryRun}) ===`);

  const recentPosts = getRecentPostsSummary(30);
  const recentFeedback = getRecentCoachFeedback(6);
  const dayNum = parseInt(dateStr.split('-')[2], 10) || 1;
  const openingModel = OPENING_MODELS[dayNum % OPENING_MODELS.length];

  const prompt = `請為《心茶記》(Mind Tea Journal) 創辦人 Sunny 教練（ICF 專業教練）撰寫一篇全新的中英雙語專欄文章。

【強制遵循規範】
1. 避開近 30 天已發布的主題（嚴禁重複）：
${recentPosts.slice(0, 12).map(p => `- ${p.title}`).join('\n')}

2. 近期教練反饋參考（請務必遵守 ICF 去說教、不帶主觀預設立場的提問原則）：
${recentFeedback.map(f => `- ${f}`).join('\n')}

3. 本篇強制開頭模型：${openingModel}
   - 嚴禁使用「你有沒有過這樣的時刻？」或「你一定遇過這種情況：」開場！
4. 五步結構：生活/教練現場切入 -> 底層心理機制拆解 -> 茶禪思維對比卡 -> 教練覺察提問（留白、無主觀誘導） -> 溫和微步實驗與茶禪金句。
5. 嚴格排版鐵律：
   - 嚴禁出現任何 HTML 標籤（如 <div>, <ol>, <table>）或 Mermaid 語法！
   - 必須使用標準 Markdown 引用塊 \`>\` 撰寫「🌲 **心智框架对比：...**」（含 ❌ 舊慣性 vs 💡 願景框架）以及「🌿 **心茶记 · 教练觉察提问：**」。
6. 語言規範：
   - 中文版（body_zh, title_zh）：100% 簡體中文。
   - 英文版（body_en, title_en）：高中生英文程度，平實自然温暖，如朋友在茶几旁對話，禁止艱澀冷僻學術詞彙。

請嚴格輸出純 JSON 格式（不要包裹在 markdown 代碼塊外，直接輸出合法 JSON 物件），包含以下欄位：
{
  "slug": "english-kebab-case-slug",
  "title_zh": "简体中文标题",
  "title_en": "High School English Title",
  "categories_zh": ["自我觉察", "核心信念"],
  "tags_zh": ["标签1", "标签2", "ICF专业教练", "心茶记"],
  "categories_en": ["Self-Awareness", "Core-Beliefs"],
  "tags_en": ["Tag1", "Tag2", "ICF-Coaching", "Mind-Tea-Journal"],
  "body_zh": "完整简体中文正文（不含 frontmatter）",
  "body_en": "Full English body (no frontmatter)",
  "cover_prompt": "Detailed 16:9 Zen tea photography prompt in English, ceramic teacup, steam, natural wood, morning light, zero text"
}`;

  const rawReply = await callGemini(prompt, '你是《心茶記》首席 ICF 教練主筆與雙語內容總監。只輸出合法 JSON。', 2);
  if (!rawReply) {
    throw new Error('Gemini API 無法產生文章內容');
  }

  const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini 回傳內容非合法 JSON 格式');
  }

  const article = JSON.parse(jsonMatch[0]);
  if (!article.slug || !article.title_zh || !article.body_zh || !article.body_en) {
    throw new Error('Gemini JSON 缺少必要欄位');
  }

  const zhFrontmatter = `---
layout: post
title: "${article.title_zh.replace(/"/g, '\\"')}"
date: ${dateStr} 08:00:00 +0800
categories: [${(article.categories_zh || ['自我觉察']).join(', ')}]
tags: [${(article.tags_zh || ['ICF专业教练', '心茶记']).join(', ')}]
permalink: /post/${article.slug}/
---

`;

  const enFrontmatter = `---
layout: post
title: "${article.title_en.replace(/"/g, '\\"')}"
date: ${dateStr} 08:00:00 +0800
categories: [${(article.categories_en || ['Self-Awareness']).join(', ')}]
tags: [${(article.tags_en || ['ICF-Coaching', 'Mind-Tea-Journal']).join(', ')}]
permalink: /post/${article.slug}/
lang: en
---

`;

  if (dryRun) {
    const dryDir = path.join(ROOT_DIR, '_drafts', 'dry_run_test');
    if (!fs.existsSync(dryDir)) fs.mkdirSync(dryDir, { recursive: true });
    fs.writeFileSync(path.join(dryDir, `${dateStr}-${article.slug}.md`), zhFrontmatter + article.body_zh.trim() + '\n', 'utf8');
    fs.writeFileSync(path.join(dryDir, `${dateStr}-${article.slug}-en.md`), enFrontmatter + article.body_en.trim() + '\n', 'utf8');
    console.log(`✅ [Dry-Run] 測試文章已成功產製於 ${dryDir}`);
    return { slug: article.slug, title: article.title_zh, dryRun: true };
  }

  const zhPath = path.join(ROOT_DIR, '_posts', `${dateStr}-${article.slug}.md`);
  const enPath = path.join(ROOT_DIR, '_posts', `${dateStr}-${article.slug}-en.md`);
  fs.writeFileSync(zhPath, zhFrontmatter + article.body_zh.trim() + '\n', 'utf8');
  fs.writeFileSync(enPath, enFrontmatter + article.body_en.trim() + '\n', 'utf8');

  // 產製 13 項社群包
  execSync(`node .agents/skills/mindtea-publish/scripts/generate_social_package.js "${zhPath}"`, { cwd: ROOT_DIR, stdio: 'inherit' });

  // 找到剛建立的社群目錄
  const socialDir = path.join(ROOT_DIR, 'social_posts');
  const targetDirName = fs.readdirSync(socialDir)
    .filter(f => f.startsWith(`${dateStr}_`) && fs.statSync(path.join(socialDir, f)).isDirectory())
    .sort()
    .reverse()[0];

  if (targetDirName) {
    const tmpCover = path.join(ROOT_DIR, '_drafts', `${article.slug}_cover.jpg`);
    await generateCoverImage(article.cover_prompt || 'Zen ceramic teacup with gentle steam on weathered natural wood table at dawn, morning sunlight', tmpCover);
    if (fs.existsSync(tmpCover)) {
      execSync(`node .agents/skills/zen-cover-designer/scripts/archive_cover.js "${tmpCover}" "${article.slug}" "${targetDirName}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
      fs.unlinkSync(tmpCover);
    }
    execSync(`node .agents/skills/mindtea-publish/scripts/render_short_video.js "social_posts/${targetDirName}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync(`node .agents/skills/cross-strait-localization/scripts/lint_social_posts.js "${targetDirName}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
  }

  return {
    slug: article.slug,
    title: article.title_zh,
    zhPath,
    enPath,
    targetDirName
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dateIdx = args.indexOf('--date');
  const date = dateIdx !== -1 ? args[dateIdx + 1] : undefined;
  generateDailyPost({ date, dryRun })
    .then(res => {
      console.log('🎉 每日自動產製完成:', JSON.stringify(res));
    })
    .catch(err => {
      console.error('❌ 每日自動產製失敗:', err);
      process.exitCode = 1;
    });
}

module.exports = { generateDailyPost };
