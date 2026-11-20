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

function parseMermaid(code) {
  const nodeMap = new Map();
  const orderedNodes = [];
  const edges = [];
  const lines = code.split(/\r?\n/);
  let direction = 'TD';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    const dirMatch = trimmed.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL)/i);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase();
      continue;
    }

    const nodeMatches = line.matchAll(/([A-Za-z0-9_]+)\["([^"]+)"\]|([A-Za-z0-9_]+)\[([^\]]+)\]/g);
    for (const m of nodeMatches) {
      const id = m[1] || m[3];
      const text = m[2] || m[4];
      if (!nodeMap.has(id)) {
        nodeMap.set(id, text);
        orderedNodes.push({ id, text });
      }
    }

    const edgeMatches = line.matchAll(/([A-Za-z0-9_]+)(?:\[[^\]]*\])?\s*(?:-->|--[^-]+-->)\s*(?:\|([^|]*)\|\s*)?([A-Za-z0-9_]+)/g);
    for (const em of edgeMatches) {
      edges.push({ from: em[1], to: em[3], label: em[2] ? em[2].trim() : '' });
    }
  }

  return { direction, nodes: orderedNodes, edges, nodeMap };
}

function renderNodeCard(text) {
  const parts = text.split(/<br\s*\/?>/i);
  const title = parts[0] ? parts[0].trim() : '';
  const sub = parts.slice(1).join('<br>').trim();
  let inner = `<strong style="color: #2d4a3e; font-size: 15px;">${title}</strong>`;
  if (sub) {
    inner += `<div style="color: #556b5d; font-size: 13.5px; margin-top: 4px; line-height: 1.5;">${sub}</div>`;
  }
  return `<div style="width: 100%; box-sizing: border-box; background: #ffffff; border: 1px solid #cad5c5; border-radius: 8px; padding: 12px 16px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">${inner}</div>`;
}

function convertMermaidToHtml(mermaidCode, isTraditional = true) {
  const { direction, nodes, edges } = parseMermaid(mermaidCode);
  if (!nodes.length) {
    return `<pre style="background: rgba(230, 240, 232, 0.45); border: 1px solid #c8d8cf; border-radius: 8px; padding: 14px; overflow-x: auto; font-size: 14px;"><code>${mermaidCode.trim()}</code></pre>`;
  }

  // Detect loop back to the first node
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const hasCycle = edges.some(e => e.to === firstNode.id && nodes.some(n => n.id === e.from));

  // Check if it's a simple chain vs branching
  const outgoingCount = {};
  edges.forEach(e => {
    outgoingCount[e.from] = (outgoingCount[e.from] || 0) + 1;
  });
  const maxOutgoing = Math.max(0, ...Object.values(outgoingCount));
  const isBranching = maxOutgoing > 1;

  // Horizontal layout is strictly reserved for short single-line LR flows
  const allShort = nodes.every(n => !n.text.includes('<br>') && n.text.length < 15);
  const useHorizontal = direction === 'LR' && nodes.length <= 3 && !isBranching && !hasCycle && allShort;

  if (useHorizontal) {
    const cardsHtml = nodes.map((node, idx) => {
      let card = renderNodeCard(node.text);
      if (idx < nodes.length - 1) {
        card += `\n    <span style="color: #6b8e23; font-weight: bold; font-size: 1.2em; flex-shrink: 0;">➔</span>`;
      }
      return card;
    }).join('\n    ');

    return `<div style="background: rgba(230, 240, 232, 0.5); border: 1px solid #a3b899; border-radius: 12px; padding: 20px; margin: 24px 0;">\n  <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">\n    ${cardsHtml}\n  </div>\n</div>`;
  }

  // Vertical Stepper Layout (Default & Universal, using <table> for 100% WYSIWYG editor compatibility)
  if (!isBranching) {
    const tableRows = [];
    nodes.forEach((node, idx) => {
      const parts = node.text.split(/<br\s*\/?>/i);
      const title = parts[0] ? parts[0].trim() : '';
      const sub = parts.slice(1).join('<br>').trim();
      let inner = `<strong style="color: #2d4a3e; font-size: 15px;">${title}</strong>`;
      if (sub) {
        inner += `<div style="color: #556b5d; font-size: 13.5px; margin-top: 4px; line-height: 1.5;">${sub}</div>`;
      }
      tableRows.push(`    <tr>\n      <td style="background: #ffffff; border: 1px solid #cad5c5; border-radius: 8px; padding: 12px 16px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">${inner}</td>\n    </tr>`);
      if (idx < nodes.length - 1) {
        tableRows.push(`    <tr>\n      <td style="text-align: center; padding: 3px 0; color: #6b8e23; font-weight: bold; font-size: 18px; line-height: 1;">↓</td>\n    </tr>`);
      }
    });

    let loopRow = '';
    if (hasCycle) {
      const loopLabel = isTraditional
        ? '形成經驗學習的正向閉環（循環驅動下一輪具體行動）'
        : '形成经验学习的正向闭环（循环驱动下一轮具体行动）';
      loopRow = `\n    <tr>\n      <td style="text-align: center; padding: 3px 0; color: #6b8e23; font-weight: bold; font-size: 18px; line-height: 1;">↓</td>\n    </tr>\n    <tr>\n      <td style="background: #ffffff; border: 1.5px dashed #a3b899; border-radius: 20px; padding: 8px 16px; text-align: center; color: #2d4a3e; font-size: 13.5px;">\n        <span style="color: #6b8e23; font-weight: bold; font-size: 1.15em;">↺</span> <strong>${isTraditional ? '循環閉環' : '循环闭环'}</strong>：${loopLabel}\n      </td>\n    </tr>`;
    }

    return `<div style="background: rgba(230, 240, 232, 0.45); border: 1px solid #a3b899; border-radius: 12px; padding: 20px 16px; margin: 24px 0;">\n<table style="width: 100%; max-width: 520px; margin: 0 auto; border-collapse: separate; border-spacing: 0 4px; border: none;">\n  <tbody>\n${tableRows.join('\n')}${loopRow}\n  </tbody>\n</table>\n</div>`;
  }

  // Branching Layout: Converted into a high-compatibility native <table> for WYSIWYG editors
  const rootNode = nodes[0];
  const rootEdges = edges.filter(e => e.from === rootNode.id);
  const branchTargets = rootEdges.map(e => e.to);

  const branches = branchTargets.map(targetId => {
    const branchNodes = [nodes.find(n => n.id === targetId)].filter(Boolean);
    let curr = targetId;
    while (true) {
      const nextEdge = edges.find(e => e.from === curr && e.to !== rootNode.id);
      if (nextEdge) {
        const nextNode = nodes.find(n => n.id === nextEdge.to);
        if (nextNode && !branchNodes.some(bn => bn.id === nextNode.id)) {
          branchNodes.push(nextNode);
          curr = nextNode.id;
          continue;
        }
      }
      break;
    }
    return branchNodes;
  });

  const allTexts = nodes.map(n => n.text).join(' ');
  const isContrast = /反擊|退縮|攻擊|防禦|陷阱|對撞|肉搏|死局|破局|解決|借力打力|反击|退缩|防御|对撞|肉搏/.test(allTexts);

  const rootParts = rootNode.text.split(/<br\s*\/?>/i);
  const rootTitle = rootParts[0] ? rootParts[0].trim() : '';
  const rootSub = rootParts.slice(1).join(' ').trim();

  const rowsHtml = branches.map((bNodes, bIdx) => {
    const isLastBranch = bIdx === branches.length - 1;
    const isHighlight = isContrast && isLastBranch;
    const rowBg = isHighlight ? '#f4f8f5' : (bIdx % 2 === 1 ? '#f9fbf9' : '#ffffff');
    const borderColor = isHighlight ? '#a3b899' : '#e2ece5';

    const firstNode = bNodes[0];
    const restNodes = bNodes.slice(1);

    const firstParts = firstNode ? firstNode.text.split(/<br\s*\/?>/i) : [''];
    const branchTitle = firstParts[0].trim();
    const branchSub = firstParts.slice(1).join('<br>').trim();

    let tagBadge = '';
    if (isContrast) {
      tagBadge = isHighlight
        ? `<span style="display: inline-block; background: #eaf1ec; color: #2d4a3e; font-size: 12px; font-weight: bold; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px;">💡 ${isTraditional ? '破局路徑' : '破局路径'}</span><br>`
        : `<span style="display: inline-block; background: #fdf2f0; color: #8c4e48; font-size: 12px; font-weight: bold; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px;">⚠️ ${isTraditional ? `路徑 ${bIdx + 1}` : `路径 ${bIdx + 1}`}</span><br>`;
    }

    const col1Content = `
      ${tagBadge}<strong style="color: ${isHighlight ? '#2d4a3e' : '#1e3324'}; font-size: 15px;">${branchTitle}</strong>
      ${branchSub ? `<div style="color: #556b5d; font-size: 13.5px; margin-top: 4px; line-height: 1.5;">${branchSub}</div>` : ''}
    `;

    const col2Content = restNodes.map(rn => {
      const parts = rn.text.split(/<br\s*\/?>/i);
      const t = parts[0].trim();
      const s = parts.slice(1).join('<br>').trim();
      return `<div style="margin: 4px 0;"><span style="color: #2c2523; font-weight: 500;">${t}</span>${s ? `<div style="color: #62786a; font-size: 13px;">${s}</div>` : ''}</div>`;
    }).join('<div style="color: #a3b899; text-align: center; font-size: 13px; line-height: 1.2;">↓</div>') || '—';

    return `    <tr style="background-color: ${rowBg}; border-bottom: 1px solid ${borderColor};">
      <td style="padding: 14px 16px; border: 1px solid ${borderColor}; width: 45%; vertical-align: top;">
        ${col1Content}
      </td>
      <td style="padding: 14px 16px; border: 1px solid ${borderColor}; width: 55%; vertical-align: top; line-height: 1.6;">
        ${col2Content}
      </td>
    </tr>`;
  }).join('\n');

  return `<div style="overflow-x: auto; margin: 24px 0;">
<table style="width: 100%; border-collapse: collapse; border: 1.5px solid #a3b899; border-radius: 8px; overflow: hidden; background: #ffffff;">
  <thead>
    <tr style="background-color: #eaf1ec; border-bottom: 2px solid #a3b899;">
      <th colspan="2" style="padding: 14px 18px; color: #1e3324; font-weight: bold; border: 1px solid #d5e2d8; font-size: 15.5px; text-align: center;">
        🌲 ${rootTitle}${rootSub ? ` <span style="font-weight: normal; font-size: 13.5px; color: #4a6654;">（${rootSub}）</span>` : ''}
      </th>
    </tr>
  </thead>
  <tbody>
${rowsHtml}
  </tbody>
</table>
</div>`;
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function convertTableToHtml(tableLines) {
  if (!tableLines || tableLines.length < 2) return '';

  function splitRow(line) {
    let t = line.trim();
    if (t.startsWith('|')) t = t.substring(1);
    if (t.endsWith('|')) t = t.substring(0, t.length - 1);
    return t.split('|').map(c => c.trim());
  }

  const headerCells = splitRow(tableLines[0]);
  const delimCells = splitRow(tableLines[1]);
  const alignments = delimCells.map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  const theadThs = headerCells.map((cell, idx) => {
    const align = alignments[idx] || 'left';
    return `<th style="padding: 12px 14px; background-color: #eaf1ec; color: #1e3324; font-weight: 600; border: 1px solid #d5e2d8; font-size: 15px; text-align: ${align};">${inlineFormat(cell)}</th>`;
  }).join('\n      ');

  const theadHtml = `  <thead>\n    <tr style="border-bottom: 2px solid #a3b899;">\n      ${theadThs}\n    </tr>\n  </thead>`;

  const bodyRows = [];
  for (let r = 2; r < tableLines.length; r++) {
    const rowCells = splitRow(tableLines[r]);
    const isEven = (r - 2) % 2 === 1;
    const rowBg = isEven ? '#f9fbf9' : '#ffffff';
    const rowTds = headerCells.map((_, idx) => {
      const cell = rowCells[idx] !== undefined ? rowCells[idx] : '';
      const align = alignments[idx] || 'left';
      return `<td style="padding: 12px 14px; border: 1px solid #e2ece5; color: #2c2523; font-size: 15px; text-align: ${align}; line-height: 1.6;">${inlineFormat(cell)}</td>`;
    }).join('\n      ');
    bodyRows.push(`    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2ece5;">\n      ${rowTds}\n    </tr>`);
  }

  const tbodyHtml = `  <tbody>\n${bodyRows.join('\n')}\n  </tbody>`;

  return `<div style="overflow-x: auto; margin: 24px 0;">\n<table style="width: 100%; border-collapse: collapse; border: 1px solid #d5e2d8; border-radius: 6px; overflow: hidden; background: #ffffff;">\n${theadHtml}\n${tbodyHtml}\n</table>\n</div>`;
}

function parseMarkdown(md, lang = 'zh-TW') {
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

    // Fenced Code Blocks (```)
    if (trimmed.startsWith('```')) {
      flushList();
      flushBlockquote();
      const codeLang = trimmed.slice(3).trim().toLowerCase();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeContent = codeLines.join('\n');
      if (codeLang === 'mermaid' || codeLang === 'flowchart') {
        html.push(convertMermaidToHtml(codeContent, lang === 'zh-TW'));
      } else {
        html.push(`<pre style="background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 14px; overflow-x: auto; font-size: 14px;"><code>${codeContent}</code></pre>`);
      }
      continue;
    }

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

    // Markdown Table
    if (trimmed.includes('|') && i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1].trim();
      const isTableDelim = /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(nextTrimmed);
      if (isTableDelim) {
        flushBlockquote();
        const tableLines = [trimmed, nextTrimmed];
        i += 2;
        while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
          tableLines.push(lines[i].trim());
          i++;
        }
        i--;
        html.push(convertTableToHtml(tableLines));
        continue;
      }
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
  table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 15px; border: 1px solid #d5e2d8; border-radius: 6px; overflow: hidden; }
  th { padding: 12px 14px; background-color: #eaf1ec; color: #1e3324; font-weight: 600; border: 1px solid #d5e2d8; font-size: 15px; }
  td { padding: 12px 14px; border: 1px solid #e2ece5; color: #2c2523; font-size: 15px; line-height: 1.6; }
  tr:nth-child(even) td { background-color: #f9fbf9; }
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
  const bodyHtml = parseMarkdown(markdownContent, lang);
  const fullHtml = generateHtmlPage(title, bodyHtml, lang);
  fs.writeFileSync(outputPath, fullHtml, 'utf8');
}

module.exports = {
  parseMarkdown,
  generateHtmlPage,
  renderMarkdownToHtmlFile
};
