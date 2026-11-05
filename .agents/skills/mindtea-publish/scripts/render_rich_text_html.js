const fs = require('fs');
const path = require('path');

function convertCoachingBoxes(text) {
  return text.replace(/<div\s+class=["'](?:coaching|reflection)-box["']>([\s\S]*?)<\/div>/gi, (match, inner) => {
    let cleaned = inner
      .replace(/<\/?p>/gi, '')
      .replace(/<\/?ol>/gi, '')
      .replace(/<\/?ul>/gi, '')
      .trim();

    let liIdx = 1;
    cleaned = cleaned.replace(/<li>([\s\S]*?)<\/li>/gi, (m, liContent) => {
      return `${liIdx++}. ${liContent.trim()}\n`;
    });

    const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    return lines.map(l => `> ${l}`).join('\n>\n');
  });
}

function parseMarkdown(md) {
  // Pre-process any raw HTML coaching boxes into clean markdown blockquotes
  const normalizedMd = convertCoachingBoxes(md || '');
  const lines = normalizedMd.split(/\r?\n/);
  const html = [];
  let inList = false;
  let listType = '';
  let inBlockquote = false;
  let blockquoteLines = [];

  function flushList() {
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
      listType = '';
    }
  }

  function flushBlockquote() {
    if (inBlockquote) {
      const innerHtml = [];
      let bqInList = false;
      let bqListType = '';

      function bqFlushList() {
        if (bqInList) {
          innerHtml.push(`</${bqListType}>`);
          bqInList = false;
          bqListType = '';
        }
      }

      for (const rawBqLine of blockquoteLines) {
        const bqLine = rawBqLine.trim();
        // Empty lines within blockquotes preserve paragraph separation without breaking lists
        if (!bqLine) {
          continue;
        }

        const olM = bqLine.match(/^(\d+)\.\s+(.*)/);
        if (olM) {
          if (!bqInList || bqListType !== 'ol') {
            bqFlushList();
            bqInList = true;
            bqListType = 'ol';
            innerHtml.push('<ol>');
          }
          innerHtml.push(`  <li>${inlineFormat(olM[2])}</li>`);
          continue;
        }

        const ulM = bqLine.match(/^[-*]\s+(.*)/);
        if (ulM) {
          if (!bqInList || bqListType !== 'ul') {
            bqFlushList();
            bqInList = true;
            bqListType = 'ul';
            innerHtml.push('<ul>');
          }
          innerHtml.push(`  <li>${inlineFormat(ulM[1])}</li>`);
          continue;
        }

        bqFlushList();
        innerHtml.push(`  <p>${inlineFormat(bqLine)}</p>`);
      }
      bqFlushList();

      const bqStyle = 'margin: 20px 0; padding: 16px 22px; background: #f4f8f5; border-left: 4px solid #4a7c59; border-radius: 0 8px 8px 0; color: #2d4533; font-size: 15.5px;';
      html.push(`<blockquote style="${bqStyle}">\n${innerHtml.join('\n')}\n</blockquote>`);
      inBlockquote = false;
      blockquoteLines = [];
    }
  }

  function inlineFormat(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check if line is an indented quote inside an active list item
    if (inList && /^\s+>\s?(.*)/.test(rawLine)) {
      const quoteText = rawLine.replace(/^\s+>\s?/, '').trim();
      const lastItemIdx = html.length - 1;
      if (lastItemIdx >= 0 && html[lastItemIdx].endsWith('</li>')) {
        const prevItem = html[lastItemIdx].slice(0, -5);
        html[lastItemIdx] = `${prevItem}<br/>\n  <blockquote style="margin: 8px 0; padding: 8px 14px; border-left: 3px solid #4a7c59; background: #f4f8f5; border-radius: 4px; font-size: 14.5px;">${inlineFormat(quoteText)}</blockquote></li>`;
      } else {
        html.push(`<blockquote>${inlineFormat(quoteText)}</blockquote>`);
      }
      continue;
    }

    // Standard Blockquote (starts with >)
    if (/^>\s?(.*)/.test(trimmed)) {
      flushList();
      inBlockquote = true;
      blockquoteLines.push(trimmed.replace(/^>\s?/, ''));
      continue;
    } else {
      flushBlockquote();
    }

    // HR
    if (/^---$/.test(trimmed)) {
      flushList();
      html.push('<hr/>');
      continue;
    }

    // Headers
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      html.push(`<h${level}>${inlineFormat(hMatch[2])}</h${level}>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        flushList();
        inList = true;
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        flushList();
        inList = true;
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    flushList();

    // Empty line
    if (trimmed === '') {
      continue;
    }

    // Pass through raw HTML blocks without wrapping them in invalid <p>
    if (/^<\/?(div|p|ol|ul|li|blockquote|h[1-6]|hr|table|tr|td|th|section|article)\b/i.test(trimmed)) {
      html.push(trimmed);
      continue;
    }

    // Paragraph
    html.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  flushBlockquote();
  flushList();

  return html.join('\n');
}

function generateHtmlPage(title, bodyHtml, lang = 'zh-TW') {
  const isTW = lang === 'zh-TW';
  const toolbarHint = isTW
    ? '💡 點擊右側按鈕（或按 Ctrl+A 全選後複製），即可直接貼上方格子編輯器，格式與字體完美保留。'
    : '💡 点击右侧按钮（或按 Ctrl+A 全选后复制），即可直接粘贴知乎专栏编辑器，格式与段落完美保留。';
  const copyBtnText = isTW ? '📋 一鍵複製富文本' : '📋 一键复制富文本';
  const copiedBtnText = isTW ? '✅ 已複製富文本！可直接貼上' : '✅ 已复制富文本！可直接粘贴';
  const copyAlertFail = isTW
    ? '瀏覽器不支援自動複製，請直接在頁面按 Ctrl+A 全選後按 Ctrl+C 複製'
    : '浏览器不支持自动复制，请直接在页面按 Ctrl+A 全选后按 Ctrl+C 复制';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif;
    line-height: 1.85;
    color: #2c2523;
    background-color: #faf8f5;
    margin: 0;
    padding: 24px;
  }
  .container {
    max-width: 760px;
    margin: 0 auto;
    background: #ffffff;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  }
  .toolbar {
    position: sticky;
    top: 12px;
    z-index: 999;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #4a7c59;
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 8px;
    margin-bottom: 28px;
    box-shadow: 0 4px 12px rgba(74, 124, 89, 0.25);
  }
  .toolbar-hint {
    font-size: 14px;
    font-weight: 500;
  }
  .copy-btn {
    background: #ffffff;
    color: #244b30;
    border: none;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 18px;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    transition: all 0.2s ease;
  }
  .copy-btn:hover {
    background: #e9f2eb;
    transform: translateY(-1px);
  }
  h1 { font-size: 26px; color: #1e3324; margin-top: 0; line-height: 1.4; border-bottom: 2px solid #eaf0eb; padding-bottom: 12px; }
  h2 { font-size: 21px; color: #2d4d36; border-bottom: 1px solid #eef3ef; padding-bottom: 8px; margin-top: 36px; }
  h3 { font-size: 18px; color: #3b6647; margin-top: 26px; }
  h4 { font-size: 16px; color: #4a7c59; margin-top: 20px; }
  blockquote {
    margin: 20px 0;
    padding: 16px 20px;
    background: #f4f8f5;
    border-left: 4px solid #4a7c59;
    border-radius: 0 8px 8px 0;
    color: #2d4533;
    font-size: 15.5px;
  }
  blockquote p { margin: 8px 0; }
  blockquote p:first-child { margin-top: 0; }
  blockquote p:last-child { margin-bottom: 0; }
  blockquote ol, blockquote ul { margin: 10px 0; padding-left: 22px; }
  blockquote li { margin-bottom: 6px; }
  blockquote ol:last-child, blockquote ul:last-child { margin-bottom: 0; }
  p { margin: 16px 0; font-size: 16px; }
  hr { border: 0; height: 1px; background: #e5e3de; margin: 32px 0; }
  ul, ol { padding-left: 24px; margin: 16px 0; }
  li { margin-bottom: 8px; }
  strong { color: #1c3323; }
  a { color: #3a7550; text-decoration: underline; text-underline-offset: 3px; }
</style>
</head>
<body>
<div class="container">
  <div class="toolbar">
    <span class="toolbar-hint">${toolbarHint}</span>
    <button class="copy-btn" id="copyBtn" onclick="copyContent()">${copyBtnText}</button>
  </div>
  <article id="articleContent">
${bodyHtml}
  </article>
</div>

<script>
function copyContent() {
  const content = document.getElementById('articleContent');
  const btn = document.getElementById('copyBtn');
  
  if (navigator.clipboard && window.ClipboardItem) {
    const htmlBlob = new Blob([content.innerHTML], { type: 'text/html' });
    const textBlob = new Blob([content.innerText], { type: 'text/plain' });
    const data = [new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })];
    
    navigator.clipboard.write(data).then(() => {
      btn.innerText = '${copiedBtnText}';
      btn.style.background = '#d4edda';
      btn.style.color = '#155724';
      setTimeout(() => {
        btn.innerText = '${copyBtnText}';
        btn.style.background = '#ffffff';
        btn.style.color = '#244b30';
      }, 2500);
    }).catch(err => {
      fallbackCopy(content, btn);
    });
  } else {
    fallbackCopy(content, btn);
  }
}

function fallbackCopy(content, btn) {
  const range = document.createRange();
  range.selectNodeContents(content);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  try {
    document.execCommand('copy');
    selection.removeAllRanges();
    btn.innerText = '${copiedBtnText}';
    setTimeout(() => {
      btn.innerText = '${copyBtnText}';
    }, 2500);
  } catch (err) {
    alert('${copyAlertFail}');
  }
}
</script>
</body>
</html>`;
}

function renderMarkdownToHtmlFile(markdownContent, outputPath, title = '心茶記專欄', lang = 'zh-TW') {
  const bodyHtml = parseMarkdown(markdownContent);
  const fullHtml = generateHtmlPage(title, bodyHtml, lang);
  fs.writeFileSync(outputPath, fullHtml, 'utf8');
}

module.exports = {
  parseMarkdown,
  generateHtmlPage,
  renderMarkdownToHtmlFile
};
