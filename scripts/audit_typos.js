const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

// Refined Typo Rules (Only targeting genuine misconverted / wrong characters)
const TYPO_RULES = [
  // 1. 倒黴 (Should be 倒楣 in TW, 倒霉 in CN)
  {
    id: 'dao_mei_typo',
    pattern: /倒黴/g,
    scope: 'all',
    suggestion: '「倒黴」為選錯字。繁體台灣標準為「倒楣」（亦作「倒霉」）；簡體規範為「倒霉」',
    fixTW: (text) => text.replace(/倒黴/g, '倒楣'),
    fixCN: (text) => text.replace(/倒黴/g, '倒霉')
  },

  // 2. 復盤 (In TW, should be 覆盤 or 檢討)
  {
    id: 'fu_pan_tw',
    pattern: /復盤/g,
    scope: 'tw',
    suggestion: '「復盤」在台灣繁體中應為「覆盤」或「檢討」',
    fixTW: (text) => text.replace(/復盤/g, '覆盤')
  },

  // 3. 髮 / 發 (Hair vs Emit)
  {
    id: 'hair_fa_wrong_tw',
    pattern: /頭發|理發|剪發|假發|短發|長發|白發|染發|脫發|毛發|毫發/g,
    scope: 'tw',
    suggestion: '頭髮/毛髮/毫髮在繁體中應為「髮」，非「發」',
    fixTW: (text) => text.replace(/頭發/g, '頭髮')
                        .replace(/理發/g, '理髮')
                        .replace(/剪發/g, '剪髮')
                        .replace(/假發/g, '假髮')
                        .replace(/短發/g, '短髮')
                        .replace(/長發/g, '長髮')
                        .replace(/白發/g, '白髮')
                        .replace(/染發/g, '染髮')
                        .replace(/脫發/g, '脫髮')
                        .replace(/毛發/g, '毛髮')
                        .replace(/毫發/g, '毫髮')
  },
  {
    id: 'happen_fa_wrong_tw',
    pattern: /髮生|髮現|髮展|髮起|出髮|啟髮|激髮|奮髮/g,
    scope: 'tw',
    suggestion: '發生/發現/發展之「發」在繁體中應為「發」，非「髮」',
    fixTW: (text) => text.replace(/髮生/g, '發生')
                        .replace(/髮現/g, '發現')
                        .replace(/髮展/g, '發展')
                        .replace(/髮起/g, '發起')
                        .replace(/出髮/g, '出發')
                        .replace(/啟髮/g, '啟發')
                        .replace(/激髮/g, '激發')
                        .replace(/奮髮/g, '奮發')
  },

  // 4. 準 / 准 (Standard vs Permit)
  {
    id: 'zhun_standard_tw',
    pattern: /准備|標准|准確|水准|精准|准則/g,
    scope: 'tw',
    suggestion: '準備/標準/準確在台灣繁體中應為「準」，非「准」',
    fixTW: (text) => text.replace(/准備/g, '準備')
                        .replace(/標准/g, '標準')
                        .replace(/准確/g, '準確')
                        .replace(/水准/g, '水準')
                        .replace(/精准/g, '精準')
                        .replace(/准則/g, '準則')
  },

  // 5. 鐘 / 鍾 (Clock vs Love/Surname)
  {
    id: 'zhong_clock_tw',
    pattern: /分鍾|秒鍾|時鍾/g,
    scope: 'tw',
    suggestion: '分鐘/時鐘之「鐘」在繁體中應為金字旁「鐘」，非「鍾」',
    fixTW: (text) => text.replace(/分鍾/g, '分鐘')
                        .replace(/秒鍾/g, '秒鐘')
                        .replace(/時鍾/g, '時鐘')
  },
  {
    id: 'zhong_love_tw',
    pattern: /鐘愛|一見鐘情/g,
    scope: 'tw',
    suggestion: '鍾愛/一見鍾情之「鍾」在繁體中應為「鍾」，非「鐘」',
    fixTW: (text) => text.replace(/鐘愛/g, '鍾愛')
                        .replace(/一見鐘情/g, '一見鍾情')
  },

  // 6. 闆 / 板 (Boss vs Board)
  {
    id: 'boss_ban_tw',
    pattern: /老板/g,
    scope: 'tw',
    suggestion: '老闆在台灣繁體中應為「老闆」，非「老板」',
    fixTW: (text) => text.replace(/老板/g, '老闆')
  },
  {
    id: 'board_ban_tw',
    pattern: /白闆|木闆|黑闆|樣闆/g,
    scope: 'tw',
    suggestion: '白板/木板/樣板在繁體中應為「板」，非「闆」',
    fixTW: (text) => text.replace(/白闆/g, '白板')
                        .replace(/木闆/g, '木板')
                        .replace(/黑闆/g, '黑板')
                        .replace(/樣闆/g, '樣板')
  },

  // 7. 緻 / 致 (Delicate vs Cause/To)
  {
    id: 'zhi_delicate_tw',
    pattern: /細致|精致|別致/g,
    scope: 'tw',
    suggestion: '細緻/精緻/別緻在繁體中應為「緻」，非「致」',
    fixTW: (text) => text.replace(/細致/g, '細緻')
                        .replace(/精致/g, '精緻')
                        .replace(/別致/g, '別緻')
  },
  {
    id: 'zhi_cause_tw',
    pattern: /導緻|一緻/g,
    scope: 'tw',
    suggestion: '導致/一致在繁體中應為「致」，非「緻」',
    fixTW: (text) => text.replace(/導緻/g, '導致')
                        .replace(/一緻/g, '一致')
  },

  // 8. 乾 / 幹 / 干 (Dry vs Work vs Shield)
  {
    id: 'gan_dry_tw',
    pattern: /幹淨|幹燥|餅幹|風幹|烘幹/g,
    scope: 'tw',
    suggestion: '乾淨/乾燥/餅乾在繁體中應為「乾」，非「幹」',
    fixTW: (text) => text.replace(/幹淨/g, '乾淨')
                        .replace(/幹燥/g, '乾燥')
                        .replace(/餅幹/g, '餅乾')
                        .replace(/風幹/g, '風乾')
                        .replace(/烘幹/g, '烘乾')
  },
  {
    id: 'gan_work_tw',
    pattern: /乾活|乾部|骨乾|埋頭苦乾/g,
    scope: 'tw',
    suggestion: '幹活/幹部/骨幹在繁體中應為「幹」，非「乾」',
    fixTW: (text) => text.replace(/乾活/g, '幹活')
                        .replace(/乾部/g, '幹部')
                        .replace(/骨乾/g, '骨幹')
                        .replace(/埋頭苦乾/g, '埋頭苦幹')
  },

  // 9. 籤 / 簽 (Label vs Sign)
  {
    id: 'qian_label_tw',
    pattern: /標簽|抽簽|便簽/g,
    scope: 'tw',
    suggestion: '標籤/抽籤/便籤在繁體中應為「籤」，非「簽」',
    fixTW: (text) => text.replace(/標簽/g, '標籤')
                        .replace(/抽簽/g, '抽籤')
                        .replace(/便簽/g, '便籤')
  },

  // 10. 歷 / 曆 (Experience vs Calendar)
  {
    id: 'li_history_tw',
    pattern: /經曆|曆史|遊曆|履曆/g,
    scope: 'tw',
    suggestion: '經歷/歷史/履歷在繁體中應為「歷」，非「曆」',
    fixTW: (text) => text.replace(/經曆/g, '經歷')
                        .replace(/曆史/g, '歷史')
                        .replace(/遊曆/g, '遊歷')
                        .replace(/履曆/g, '履歷')
  },
  {
    id: 'li_calendar_tw',
    pattern: /日歷|月歷|農歷|年歷/g,
    scope: 'tw',
    suggestion: '日曆/月曆/農曆在繁體中應為「曆」，非「歷」',
    fixTW: (text) => text.replace(/日歷/g, '日曆')
                        .replace(/月歷/g, '月曆')
                        .replace(/農歷/g, '農曆')
                        .replace(/年歷/g, '年曆')
  },

  // 11. 複 / 復 (Complex/Repeat vs Recover)
  {
    id: 'fu_complex_tw',
    pattern: /復雜|重復|復習|繁復|錯綜復雜/g,
    scope: 'tw',
    suggestion: '複雜/重複/繁複在繁體中應為「複」，非「復」',
    fixTW: (text) => text.replace(/復雜/g, '複雜')
                        .replace(/重復/g, '重複')
                        .replace(/復習/g, '複習')
                        .replace(/繁復/g, '繁複')
                        .replace(/錯綜復雜/g, '錯綜複雜')
  },
  {
    id: 'fu_recover_tw',
    pattern: /恢複|康複|複甦|光複/g,
    scope: 'tw',
    suggestion: '恢復/康復在繁體中應為「復」，非「複」',
    fixTW: (text) => text.replace(/恢複/g, '恢復')
                        .replace(/康複/g, '康復')
                        .replace(/複甦/g, '復甦')
                        .replace(/光複/g, '光復')
  },

  // 12. 裡 / 里 (Inside vs Mile/Village)
  {
    id: 'li_inside_tw',
    pattern: /這里|那里|哪里|心里|屋里|房里|手里|口里|眼里/g,
    scope: 'tw',
    suggestion: '這裡/那裡/心裡在繁體中應為「裡」，非「里」',
    fixTW: (text) => text.replace(/這里/g, '這裡')
                        .replace(/那里/g, '那裡')
                        .replace(/哪里/g, '哪裡')
                        .replace(/心里/g, '心裡')
                        .replace(/屋里/g, '屋裡')
                        .replace(/房里/g, '房裡')
                        .replace(/手里/g, '手裡')
                        .replace(/口里/g, '口裡')
                        .replace(/眼里/g, '眼裡')
  },

  // 13. 彙 / 匯 (Vocabulary vs Remit)
  {
    id: 'hui_vocab_tw',
    pattern: /詞匯|語匯|字匯/g,
    scope: 'tw',
    suggestion: '詞彙/語彙在繁體中應為「彙」，非「匯」',
    fixTW: (text) => text.replace(/詞匯/g, '詞彙')
                        .replace(/語匯/g, '語彙')
                        .replace(/字匯/g, '字彙')
  },

  // 14. 採 / 采 (Gather vs Color/Grace)
  {
    id: 'cai_collect_tw',
    pattern: /采集|采取|采納|采訪/g,
    scope: 'tw',
    suggestion: '採集/採取/採納在繁體中應為「採」，非「采」',
    fixTW: (text) => text.replace(/采集/g, '採集')
                        .replace(/采取/g, '採取')
                        .replace(/采納/g, '採納')
                        .replace(/采訪/g, '採訪')
  },

  // 15. 後 / 后 (Behind vs Queen)
  {
    id: 'hou_behind_tw',
    pattern: /背后|后來|往后|身后|后果|后悔|最后|隨后/g,
    scope: 'tw',
    suggestion: '背後/後來/身後在繁體中應為「後」，非「后」',
    fixTW: (text) => text.replace(/背后/g, '背後')
                        .replace(/后來/g, '後來')
                        .replace(/往后/g, '往後')
                        .replace(/身后/g, '身後')
                        .replace(/后果/g, '後果')
                        .replace(/后悔/g, '後悔')
                        .replace(/最后/g, '最後')
                        .replace(/隨后/g, '隨後')
  },
  {
    id: 'hou_queen_tw',
    pattern: /皇後/g,
    scope: 'all',
    suggestion: '皇后之「后」不可寫作「皇後」',
    fixTW: (text) => text.replace(/皇後/g, '皇后'),
    fixCN: (text) => text.replace(/皇後/g, '皇后')
  },

  // 16. 係 / 系 (System vs Relate)
  {
    id: 'xi_system_tw',
    pattern: /係統|係列|體係/g,
    scope: 'tw',
    suggestion: '系統/系列/體系在繁體中應為「系」，非「係」',
    fixTW: (text) => text.replace(/係統/g, '系統')
                        .replace(/係列/g, '系列')
                        .replace(/體係/g, '體系')
  },
  {
    id: 'xi_tie_tw',
    pattern: /聯系|維係/g,
    scope: 'tw',
    suggestion: '聯繫/維繫在繁體中應為「繫」，非「係」',
    fixTW: (text) => text.replace(/聯系/g, '聯繫').replace(/維係/g, '維繫')
  }
];

function scanFiles(dir, exts = ['.md', '.txt', '.html']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (item === '.git' || item === 'node_modules' || item === 'assets' || item === 'references' || item === '_layouts' || item === 'js') continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(scanFiles(full, exts));
    } else if (exts.includes(path.extname(item).toLowerCase())) {
      if (item.startsWith('QA_') || item.startsWith('AGENTS') || item.startsWith('GEMINI')) continue;
      results.push(full);
    }
  }
  return results;
}

const allFiles = scanFiles(repoRoot);
const findings = [];

for (const f of allFiles) {
  const relPath = path.relative(repoRoot, f);
  if (relPath.startsWith('scripts\\audit_typos') || relPath.startsWith('scripts/audit_typos')) continue;
  if (relPath.startsWith('scripts\\fix_') || relPath.startsWith('scripts/fix_')) continue;
  if (relPath.endsWith('AGENTS.md') || relPath.endsWith('GEMINI.md') || relPath.endsWith('QA_CHECKLIST.md')) continue;

  let isTW = false;
  let isCN = false;
  if (relPath.includes('04_方格子') || relPath.includes('01_Facebook') || relPath.includes('02_LinkedIn') || relPath.includes('03_Threads')) {
    isTW = true;
  } else if (relPath.startsWith('_posts') || relPath.includes('07_知乎') || relPath.includes('05_微信') || relPath.includes('06_小紅書')) {
    if (relPath.endsWith('-en.md')) continue; // Skip English
    isCN = true;
  }

  const content = fs.readFileSync(f, 'utf8');

  for (const rule of TYPO_RULES) {
    if (rule.scope === 'tw' && !isTW) continue;
    if (rule.scope === 'cn' && !isCN) continue;

    // Reset regex lastIndex to avoid stateful regex bugs across files
    rule.pattern.lastIndex = 0;
    let matches = content.match(rule.pattern);
    if (matches) {
      matches = Array.from(new Set(matches));
      findings.push({
        file: relPath,
        isTW,
        isCN,
        ruleId: rule.id,
        matches,
        suggestion: rule.suggestion,
        rule
      });
    }
  }
}

console.log(`Scan completed. Found ${findings.length} genuine typo/misconversion instances across files:\n`);
for (const item of findings) {
  console.log(`[${item.file}] Matches: ${item.matches.join(', ')}`);
  console.log(`  -> ${item.suggestion}`);
}

module.exports = { TYPO_RULES, scanFiles };
