const fs = require('fs');
const path = require('path');

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

const repoRoot = findRepoRoot(__dirname);
const referencesDir = path.join(__dirname, '../references');

// Load strict simplified-only characters set (filtered against Taiwan MOE 4808 standard)
let simplifiedOnlySet = new Set();
const strictCharsPath = path.join(referencesDir, 'strict_simplified_chars.json');
if (fs.existsSync(strictCharsPath)) {
  const charsArr = JSON.parse(fs.readFileSync(strictCharsPath, 'utf8'));
  simplifiedOnlySet = new Set(charsArr);
} else {
  const simplifiedCharsPath = path.join(referencesDir, 'simplified_only_chars.json');
  if (fs.existsSync(simplifiedCharsPath)) {
    const charsArr = JSON.parse(fs.readFileSync(simplifiedCharsPath, 'utf8'));
    simplifiedOnlySet = new Set(charsArr);
  }
}

// Unlocalized Mainland technical terms that should not appear in Fanggezi
const UNLOCALIZED_TERMS = [
  '视频', '屏幕', '项目', '软件', '硬件', '算法', '移动端', '数据库', '程序员', '内存', '高清'
];

// Hallucinated / prohibited domains
const PROHIBITED_DOMAINS = [
  'sunnycoach.com',
  'coachsunny.com',
  'sunnycoach.github.io'
];

const OFFICIAL_DOMAIN = 'https://coachsunny.github.io/blog/';
const OFFICIAL_POST_PREFIX = 'https://coachsunny.github.io/blog/post/';

function lintDirectory(dirPath, repoRoot) {
  const dirName = path.basename(dirPath);
  const errors = [];
  const warnings = [];

  // 1. Completeness check
  const expectedFiles = [
    '01_Facebook.txt',
    '02_LinkedIn.txt',
    '03_Threads.txt',
    '04_方格子.md',
    '04_方格子.txt',
    '04_方格子_富文本預覽.html',
    '05_微信朋友圈與群.txt',
    '06_小紅書.txt',
    '07_知乎.md',
    '07_知乎.txt',
    '07_知乎_富文本預覽.html',
    '08_短視頻腳本.txt',
    'cover.jpg'
  ];

  for (const file of expectedFiles) {
    const fullPath = path.join(dirPath, file);
    if (!fs.existsSync(fullPath)) {
      errors.push(`[缺失檔案] 缺少必備資產: ${file}`);
    } else {
      const stat = fs.statSync(fullPath);
      if (stat.size === 0) {
        errors.push(`[空白檔案] 檔案大小為 0: ${file}`);
      }
    }
  }

  // 2. Check Fanggezi (04_方格子.*) for Simplified Chinese & unlocalized vocabulary
  const fgzFiles = ['04_方格子.md', '04_方格子.txt', '04_方格子_富文本預覽.html'];
  for (const fgFile of fgzFiles) {
    const fPath = path.join(dirPath, fgFile);
    if (fs.existsSync(fPath)) {
      const content = fs.readFileSync(fPath, 'utf8');
      const lines = content.split(/\r?\n/);

      // Check simplified characters using accurate Set
      lines.forEach((line, idx) => {
        // Skip HTML markup or style blocks
        if (fgFile.endsWith('.html') && (line.includes('<style>') || line.includes('<script>') || line.includes('font-family'))) {
          return;
        }
        const textToCheck = fgFile.endsWith('.html') ? line.replace(/<[^>]+>/g, '') : line;

        const foundSimplified = [];
        for (const ch of textToCheck) {
          if (simplifiedOnlySet.has(ch)) {
            foundSimplified.push(ch);
          }
        }

        if (foundSimplified.length > 0) {
          const uniqueChars = Array.from(new Set(foundSimplified)).join(', ');
          errors.push(`[方格子簡體殘留] ${fgFile} 第 ${idx + 1} 行發現簡體字: [${uniqueChars}] -> "${line.trim().slice(0, 50)}"`);
        }

        // Check unlocalized terms
        for (const term of UNLOCALIZED_TERMS) {
          if (line.includes(term)) {
            warnings.push(`[未在地化詞彙] ${fgFile} 第 ${idx + 1} 行包含大陸慣用詞「${term}」`);
          }
        }
      });
    }
  }

  // 3. Check Xiaohongshu (06_小紅書.txt) for 0-link rule and search guidance
  const xhsPath = path.join(dirPath, '06_小紅書.txt');
  if (fs.existsSync(xhsPath)) {
    const xhsContent = fs.readFileSync(xhsPath, 'utf8');
    const xhsLines = xhsContent.split(/\r?\n/);

    xhsLines.forEach((line, idx) => {
      if (/(https?:\/\/|www\.|\.com\b|\.io\b|\.org\b|\.net\b)/i.test(line)) {
        errors.push(`[小紅書外鏈違規] 06_小紅書.txt 第 ${idx + 1} 行偵測到外部連結 (平台演算法會限流): "${line.trim()}"`);
      }
    });

    const hasBrand = xhsContent.includes('心茶記') || xhsContent.includes('心茶记');
    const hasSearch = xhsContent.includes('搜尋') || xhsContent.includes('搜索');
    if (!hasBrand || !hasSearch) {
      warnings.push(`[小紅書導流提示] 06_小紅書.txt 未檢測到標準專欄搜尋引導語 (建議包含「心茶記 Sunny」搜尋指引)`);
    }
  }

  // 4. Domain & URL check across all text/markdown/html files
  const allFiles = fs.readdirSync(dirPath);
  for (const f of allFiles) {
    const ext = path.extname(f).toLowerCase();
    if (['.txt', '.md', '.html'].includes(ext)) {
      const fPath = path.join(dirPath, f);
      const content = fs.readFileSync(fPath, 'utf8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, idx) => {
        // Prohibited domain check
        for (const badDomain of PROHIBITED_DOMAINS) {
          if (line.includes(badDomain)) {
            errors.push(`[臆測錯誤網域] ${f} 第 ${idx + 1} 行出現違規網域 "${badDomain}": "${line.trim()}"`);
          }
        }

        // URL format validation - clean out trailing tags or punctuation
        const urlMatches = line.match(/https?:\/\/[^\s)\]>"'<]+/g);
        if (urlMatches) {
          for (let url of urlMatches) {
            url = url.replace(/[.,;:]+$/, ''); // clean trailing punctuation
            if (url.startsWith('https://coachsunny.github.io')) {
              if (url !== OFFICIAL_DOMAIN && !url.startsWith(OFFICIAL_POST_PREFIX) && !url.startsWith('https://coachsunny.github.io/blog/assets/')) {
                warnings.push(`[URL結構異常] ${f} 第 ${idx + 1} 行出現非標準 blog 網址: ${url}`);
              }
            }
          }
        }
      });
    }
  }

  // 5. Check cover image synchronization in social_assets
  const coverPath = path.join(dirPath, 'cover.jpg');
  if (fs.existsSync(coverPath)) {
    const match = dirName.match(/^\d{4}-\d{2}-\d{2}_(.*)$/);
    if (match) {
      const postsDir = path.join(repoRoot, '_posts');
      if (fs.existsSync(postsDir)) {
        const postFiles = fs.readdirSync(postsDir);
        const datePrefix = dirName.slice(0, 10);
        const matchedPost = postFiles.find(p => p.startsWith(datePrefix));
        if (matchedPost) {
          const slug = matchedPost.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
          const assetCover = path.join(repoRoot, 'social_assets', `${slug}.jpg`);
          if (!fs.existsSync(assetCover)) {
            warnings.push(`[封面備份缺失] 缺少 social_assets/${slug}.jpg 備份封面`);
          }
        }
      }
    }
  }

  return { dirName, errors, warnings };
}

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

function main() {
  const args = process.argv.slice(2);
  const repoRoot = findRepoRoot(__dirname);
  const socialPostsRoot = path.join(repoRoot, 'social_posts');

  let targetDirs = [];

  if (args.length > 0 && args[0] !== '--all') {
    const specified = path.isAbsolute(args[0]) ? args[0] : path.resolve(process.cwd(), args[0]);
    if (fs.existsSync(specified) && fs.statSync(specified).isDirectory()) {
      targetDirs.push(specified);
    } else {
      const inSocial = path.join(socialPostsRoot, args[0]);
      if (fs.existsSync(inSocial) && fs.statSync(inSocial).isDirectory()) {
        targetDirs.push(inSocial);
      } else {
        console.error(`❌ 找不到指定目錄: ${args[0]}`);
        process.exit(1);
      }
    }
  } else {
    // Lint all directories in social_posts/
    if (!fs.existsSync(socialPostsRoot)) {
      console.error(`❌ 找不到 social_posts 目錄: ${socialPostsRoot}`);
      process.exit(1);
    }
    const entries = fs.readdirSync(socialPostsRoot, { withFileTypes: true });
    targetDirs = entries
      .filter(e => e.isDirectory())
      .map(e => path.join(socialPostsRoot, e.name));
  }

  console.log(`\n🔍 開始執行心茶記社群貼文品質檢驗 (共 ${targetDirs.length} 個目錄)...\n`);

  let totalErrors = 0;
  let totalWarnings = 0;
  let failedCount = 0;

  for (const dir of targetDirs) {
    const result = lintDirectory(dir, repoRoot);
    const hasErr = result.errors.length > 0;
    const hasWarn = result.warnings.length > 0;

    if (hasErr) {
      failedCount++;
      totalErrors += result.errors.length;
      console.log(`❌ [FAIL] ${result.dirName}`);
      result.errors.forEach(e => console.log(`   🚨 ${e}`));
    } else if (hasWarn) {
      console.log(`⚠️  [WARN] ${result.dirName}`);
    } else {
      console.log(`✅ [PASS] ${result.dirName}`);
    }

    if (hasWarn) {
      totalWarnings += result.warnings.length;
      result.warnings.forEach(w => console.log(`   💡 ${w}`));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`檢驗結果: 總共 ${targetDirs.length} 個目錄 | 通過: ${targetDirs.length - failedCount} | 失敗: ${failedCount}`);
  console.log(`嚴重錯誤 (Errors): ${totalErrors} 個 | 建議與提醒 (Warnings): ${totalWarnings} 個`);
  console.log('='.repeat(60) + '\n');

  if (totalErrors > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
