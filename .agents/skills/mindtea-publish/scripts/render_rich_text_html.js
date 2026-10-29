const fs = require('fs');
const path = require('path');

function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let inList = false;
  let listType = '';
  let inBlockquote = false;
  let blockquoteLines = [];

  function flushBlockquote() {
    if (inBlockquote) {
      const inner = blockquoteLines.map(l => inlineFormat(l)).join('<br/>\n');
      html.push(`<blockquote>${inner}</blockquote>`);
      inBlockquote = false;
      blockquoteLines = [];
    }
  }

  function flushList() {
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
      listType = '';
    }
  }

  function inlineFormat(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blockquote
    if (/^>\s?(.*)/.test(line)) {
      flushList();
      inBlockquote = true;
      blockquoteLines.push(line.replace(/^>\s?/, ''));
      continue;
    } else {
      flushBlockquote();
    }

    // HR
    if (/^---$/.test(line.trim())) {
      flushList();
      html.push('<hr/>');
      continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      html.push(`<h${level}>${inlineFormat(hMatch[2])}</h${level}>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\d+)\.\s+(.*)/);
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
    const ulMatch = line.match(/^[-*]\s+(.*)/);
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
    if (line.trim() === '') {
      continue;
    }

    // Paragraph
    html.push(`<p>${inlineFormat(line)}</p>`);
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
