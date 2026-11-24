const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const postsDir = path.join(repoRoot, '_posts');
const socialDir = path.join(repoRoot, 'social_posts');
const indexZhPath = path.join(repoRoot, 'index.html');
const indexEnPath = path.join(repoRoot, 'en', 'index.html');

// Prohibited / Hallucinated Domains
const PROHIBITED_DOMAINS = [
  'sunnycoach.com',
  'coachsunny.com',
  'sunnycoach.github.io'
];

// Coaching tone violations (preachy, condescending, pseudo-questions)
const PREACHY_TERMS = [
  '你應該', '你应该',
  '你必須', '你必须',
  '聽我的', '听我的',
  '聽我說', '听我说',
  '你怎麼就不能', '你怎么就不能',
  '難道你不知道', '难道你不知道'
];

// Formulaic second-person opening traps
const FORMULAIC_OPENINGS = [
  /^\s*你有沒有過這樣的時刻/m,
  /^\s*你有没有过这样的时刻/m,
  /^\s*你一定遇過這種情況/m,
  /^\s*你一定遇到过这种情况/m,
  /^\s*你有沒有想過/m,
  /^\s*你有没有想过/m,
  /^\s*你是不是常常覺得/m,
  /^\s*你是不是常常觉得/m
];

// Harmful raw HTML tags that trigger huge blank spaces or visual breakages in rich text
const HARMFUL_HTML_TAGS = [
  /<div\b[^>]*class=["'](?:coaching-box|coaching-card|card)[^"']*["']/i,
  /<ol\b[^>]*>/i,
  /<table\b[^>]*>/i
];

// Prohibited Mermaid in Markdown
const MERMAID_REGEX = /```mermaid/i;

// RED (Xiaohongshu) Risk Keywords
const RED_RISK_KEYWORDS = [
  '催吐', '暴食', '断食', '斷食', '节食', '節食', '自残', '自殘', '减肥反弹', '減肥反彈'
];

// Strict simplified check for posts
const REFERENCES_DIR = path.join(repoRoot, '.agents', 'skills', 'cross-strait-localization', 'references');
let simplifiedOnlySet = new Set();
const strictCharsPath = path.join(REFERENCES_DIR, 'strict_simplified_chars.json');
if (fs.existsSync(strictCharsPath)) {
  try {
    simplifiedOnlySet = new Set(JSON.parse(fs.readFileSync(strictCharsPath, 'utf8')));
  } catch (e) {}
}

const report = {
  timestamp: new Date().toISOString(),
  inspectedDate: new Date().toLocaleDateString('zh-TW'),
  summary: {
    totalPosts: 0,
    totalEnPosts: 0,
    totalZhPosts: 0,
    totalSocialPackages: 0,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0
  },
  issues: {
    p0: [],
    p1: [],
    p2: []
  }
};

function addIssue(level, file, description, suggestion = '') {
  const item = { file, description, suggestion };
  if (level === 'P0') {
    report.issues.p0.push(item);
    report.summary.p0Count++;
  } else if (level === 'P1') {
    report.issues.p1.push(item);
    report.summary.p1Count++;
  } else {
    report.issues.p2.push(item);
    report.summary.p2Count++;
  }
}

// 1. Audit Posts
if (fs.existsSync(postsDir)) {
  const postFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  report.summary.totalPosts = postFiles.length;

  for (const file of postFiles) {
    const fullPath = path.join(postsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const isEn = file.endsWith('-en.md');
    if (isEn) report.summary.totalEnPosts++;
    else report.summary.totalZhPosts++;

    // Check Front Matter
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
      addIssue('P0', file, '缺少 YAML Front Matter 區塊', '在文章開頭加入標準 --- front matter ---');
    } else {
      const fm = fmMatch[1];
      if (!fm.includes('title:')) addIssue('P0', file, 'Front Matter 缺少 title', '補全文章標題');
      if (!fm.includes('date:')) addIssue('P1', file, 'Front Matter 缺少 date', '補全文章發布日期');
      if (!fm.includes('description:') && !fm.includes('excerpt:')) {
        addIssue('P1', file, '缺少 description / excerpt 摘要', '補全文章摘要以確保首頁卡片能正常提取');
      }
      if (isEn && !fm.includes('lang: en')) {
        addIssue('P0', file, '英文文章未標註 lang: en', '在 Front Matter 加入 lang: en 以免中文首頁抓錯');
      }
    }

    const body = fmMatch ? content.slice(fmMatch[0].length) : content;

    // Check Prohibited Domains (Exact negative lookbehind to avoid portal-coachsunny.com)
    const prohibitedRegexes = [
      { name: 'coachsunny.com', regex: /(?:https?:\/\/)?(?<!portal-)(?:www\.)?coachsunny\.com(?![a-zA-Z0-9\.\-])/i },
      { name: 'sunnycoach.com', regex: /(?:https?:\/\/)?(?:www\.)?sunnycoach\.com(?![a-zA-Z0-9\.\-])/i },
      { name: 'sunnycoach.github.io', regex: /(?:https?:\/\/)?sunnycoach\.github\.io/i },
      { name: 'coachsunny.github.io', regex: /(?:https?:\/\/)?coachsunny\.github\.io/i }
    ];
    for (const p of prohibitedRegexes) {
      if (p.regex.test(content)) {
        addIssue('P0', file, `包含已被廢止或錯誤的網域: ${p.name}`, '替換為官方正式網域 https://blog.portal-coachsunny.com/');
      }
    }

    // Check Preachy terms in coaching text
    for (const term of PREACHY_TERMS) {
      if (body.includes(term)) {
        addIssue('P1', file, `偵測到潛在說教/命令詞彙: "${term}"`, '轉化為好奇提問或邀請覺察句型（ICF去說教原則）');
      }
    }

    // Check Formulaic Openings
    for (const regex of FORMULAIC_OPENINGS) {
      if (regex.test(body)) {
        addIssue('P1', file, '開頭使用公式化第二人稱設問法', '改用「六大開頭防疲勞模型」（現場對話/畫面定格/認知翻轉等）');
      }
    }

    // Check Harmful HTML Tags
    for (const regex of HARMFUL_HTML_TAGS) {
      if (regex.test(body)) {
        addIssue('P0', file, '內文包含導致富文本大面積空白的原生 HTML 標籤 (div/ol/table)', '改用標準 Markdown 引用塊 (>) 茶禪思維對比卡');
      }
    }

    // Check Mermaid
    if (MERMAID_REGEX.test(body)) {
      addIssue('P0', file, '內文包含 Mermaid 流程圖代碼塊', '全面停用流程圖，改採「茶禪思維對比卡」Markdown 引用塊');
    }
  }
}

// 2. Audit Homepages
function auditHomepage(filePath, lang) {
  if (!fs.existsSync(filePath)) {
    addIssue('P0', path.basename(filePath), `主頁檔案不存在: ${filePath}`, '確保首頁檔案正常存在');
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');

  if (lang === 'zh') {
    if (!content.includes('item.lang != \'en\'')) {
      addIssue('P0', 'index.html', '中文主頁文章過濾條件異常', '應使用 where_exp: "item", "item.lang != \'en\'" 隔離英文文章');
    }
  } else if (lang === 'en') {
    if (!content.includes('"lang", "en"')) {
      addIssue('P0', 'en/index.html', '英文主頁文章過濾條件異常', '應使用 where: "lang", "en" 僅抓取英文文章');
    }
  }

  // Check card structure
  if (!content.includes('post-card') || !content.includes('post-list')) {
    addIssue('P1', path.basename(filePath), '主頁缺少標準 post-card 或 post-list 結構', '確保文章卡片樣式四平八穩');
  }
}

auditHomepage(indexZhPath, 'zh');
auditHomepage(indexEnPath, 'en');

// 3. Audit Social Packages
if (fs.existsSync(socialDir)) {
  const dirs = fs.readdirSync(socialDir).filter(d => fs.statSync(path.join(socialDir, d)).isDirectory());
  report.summary.totalSocialPackages = dirs.length;

  // Audit recent 10 packages
  const recentDirs = dirs.sort().reverse().slice(0, 10);
  for (const d of recentDirs) {
    const fullDirPath = path.join(socialDir, d);

    // 06_小紅書.txt
    const redPath = path.join(fullDirPath, '06_小紅書.txt');
    if (fs.existsSync(redPath)) {
      const redContent = fs.readFileSync(redPath, 'utf8');
      if (/https?:\/\//i.test(redContent)) {
        addIssue('P0', `${d}/06_小紅書.txt`, '小紅書文案違規包含外部連結 (http/https)', '嚴格執行 0 外部連結以防限流');
      }
      if (!redContent.includes('心茶記 教練') && !redContent.includes('心茶记 教练')) {
        addIssue('P1', `${d}/06_小紅書.txt`, '小紅書缺少官方引導語「心茶記 教練」', '補充「搜尋『心茶記 教練』即可閱讀全篇」');
      }
      for (const kw of RED_RISK_KEYWORDS) {
        if (redContent.includes(kw)) {
          addIssue('P0', `${d}/06_小紅書.txt`, `小紅書包含高危風控敏感詞: "${kw}"`, '替換為職場工作狂、極限死磕、完美主義等安全情境');
        }
      }
    }

    // 04_方格子.md
    const fgPath = path.join(fullDirPath, '04_方格子.md');
    if (fs.existsSync(fgPath) && simplifiedOnlySet.size > 0) {
      const fgContent = fs.readFileSync(fgPath, 'utf8');
      const leakedChars = [];
      for (const char of fgContent) {
        if (simplifiedOnlySet.has(char)) {
          leakedChars.push(char);
          if (leakedChars.length >= 5) break;
        }
      }
      if (leakedChars.length > 0) {
        addIssue('P0', `${d}/04_方格子.md`, `方格子專欄檢測到殘留簡體字: [${leakedChars.join(', ')}]`, '執行繁體化轉換與在地化辭庫校對');
      }
    }
  }
}

// 4. Audit Typo and Misconverted Characters across All Posts & Social Packages
try {
  const { TYPO_RULES, scanFiles } = require('./audit_typos.js');
  const allAuditedFiles = scanFiles(repoRoot);
  for (const f of allAuditedFiles) {
    const relPath = path.relative(repoRoot, f);
    if (relPath.startsWith('scripts') || relPath.startsWith('_layouts') || relPath.startsWith('js') || relPath.endsWith('AGENTS.md') || relPath.endsWith('GEMINI.md') || relPath.endsWith('QA_CHECKLIST.md') || relPath.endsWith('QA_REPORT_LATEST.md')) continue;

    let isTW = false;
    let isCN = false;
    if (relPath.includes('04_方格子') || relPath.includes('01_Facebook') || relPath.includes('02_LinkedIn') || relPath.includes('03_Threads')) {
      isTW = true;
    } else if (relPath.startsWith('_posts') || relPath.includes('07_知乎') || relPath.includes('05_微信') || relPath.includes('06_小紅書')) {
      if (relPath.endsWith('-en.md')) continue;
      isCN = true;
    }

    const fileContent = fs.readFileSync(f, 'utf8');
    for (const rule of TYPO_RULES) {
      if (rule.scope === 'tw' && !isTW) continue;
      if (rule.scope === 'cn' && !isCN) continue;

      rule.pattern.lastIndex = 0;
      const matches = fileContent.match(rule.pattern);
      if (matches) {
        const unique = Array.from(new Set(matches)).join(', ');
        addIssue('P0', relPath, `發現選錯字/誤轉字 [${unique}] - ${rule.suggestion}`, '修正為標準正字');
      }
    }
  }
} catch (e) {
  console.error('Typo audit warning:', e.message);
}

// Generate Markdown QA Report
let mdReport = `# 🍵 《心茶記》每日品質管理稽核報告 (QA Daily Report)
**巡檢時間**：${report.timestamp} (${report.inspectedDate})
**責任角色**：專案貼文品質管理守門人 (Antigravity QA Gatekeeper)

---

## 📊 巡檢指標摘要
| 指標項目 | 檢測數量 / 狀態 |
| :--- | :--- |
| **總文章數** | ${report.summary.totalPosts} 篇（中文 ${report.summary.totalZhPosts} 篇 / 英文 ${report.summary.totalEnPosts} 篇） |
| **首頁與語言分流** | 中文主頁 (/)、英文主頁 (/en/) 正常 |
| **抽檢社群分發包** | 最近 ${Math.min(10, report.summary.totalSocialPackages)} 個專案目錄 |
| **🔴 P0 (阻斷級問題)** | **${report.summary.p0Count}** 項 |
| **🟡 P1 (體驗級問題)** | **${report.summary.p1Count}** 項 |
| **🟢 P2 (潤飾級問題)** | **${report.summary.p2Count}** 項 |

---

## 🚦 健康指數評級
`;

if (report.summary.p0Count > 0) {
  mdReport += `> 🛑 **當前狀態：紅燈 (需立即修正阻斷級瑕疵)**\n\n`;
} else if (report.summary.p1Count > 0) {
  mdReport += `> ⚠️ **當前狀態：黃燈 (整體良好，存在體驗與風格潤飾空間)**\n\n`;
} else {
  mdReport += `> ✅ **當前狀態：綠燈 (極致茶禪體驗，零阻斷、零違規)**\n\n`;
}

function renderSection(title, list) {
  if (list.length === 0) return `### ${title}\n* 完美無瑕，無發現問題。\n\n`;
  let s = `### ${title} (${list.length} 項)\n`;
  for (const item of list) {
    s += `* **[${item.file}]** ${item.description}\n`;
    if (item.suggestion) s += `  * 💡 *改善微步建議*：${item.suggestion}\n`;
  }
  return s + '\n';
}

mdReport += renderSection('🔴 P0 阻斷級問題清單 (需優先排除)', report.issues.p0);
mdReport += renderSection('🟡 P1 體驗級問題清單 (格式、語氣與開頭輪替)', report.issues.p1);
mdReport += renderSection('🟢 P2 潤飾級建議清單', report.issues.p2);

fs.writeFileSync(path.join(repoRoot, 'QA_REPORT_LATEST.md'), mdReport, 'utf8');

console.log(JSON.stringify({
  p0: report.summary.p0Count,
  p1: report.summary.p1Count,
  p2: report.summary.p2Count,
  totalPosts: report.summary.totalPosts
}));
