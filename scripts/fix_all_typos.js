const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const { TYPO_RULES, scanFiles } = require('./audit_typos.js');

const allFiles = scanFiles(repoRoot);
let totalFixCount = 0;

for (const f of allFiles) {
  const relPath = path.relative(repoRoot, f);
  // Do not touch rule definition files or scripts themselves
  if (relPath.startsWith('scripts') || relPath.startsWith('.agents') || relPath.endsWith('AGENTS.md') || relPath.endsWith('GEMINI.md') || relPath.endsWith('QA_CHECKLIST.md')) {
    continue;
  }

  let isTW = false;
  let isCN = false;
  if (relPath.includes('04_方格子') || relPath.includes('01_Facebook') || relPath.includes('02_LinkedIn') || relPath.includes('03_Threads')) {
    isTW = true;
  } else if (relPath.startsWith('_posts') || relPath.includes('07_知乎') || relPath.includes('05_微信') || relPath.includes('06_小紅書')) {
    if (relPath.endsWith('-en.md')) continue;
    isCN = true;
  }

  let content = fs.readFileSync(f, 'utf8');
  let original = content;

  for (const rule of TYPO_RULES) {
    if (rule.scope === 'tw' && !isTW) continue;
    if (rule.scope === 'cn' && !isCN) continue;

    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) {
      if (isTW && rule.fixTW) {
        content = rule.fixTW(content);
      } else if (isCN && rule.fixCN) {
        content = rule.fixCN(content);
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(f, content, 'utf8');
    console.log(`[Fixed typos in] ${relPath}`);
    totalFixCount++;
  }
}

console.log(`\nSuccessfully fixed all typos in ${totalFixCount} files!`);
