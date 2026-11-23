const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { s2tw, tw2s } = require('../../cross-strait-localization/scripts/convert_text.js');

function findEdgePath() {
  const possiblePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function renderMermaidToPng(mermaidCode, outputPath, options = {}) {
  const edgePath = findEdgePath();
  if (!edgePath) {
    throw new Error('未找到 Microsoft Edge 或 Chrome 瀏覽器，無法離線渲染流程圖。');
  }

  const { title = '' } = options;

  // Clean mermaid code: remove any leading/trailing backticks
  const cleanCode = mermaidCode
    .replace(/^```mermaid\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Build standalone high-DPI HTML
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 20px;
    background: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", "PingFang SC", "Microsoft YaHei", sans-serif;
    display: inline-block;
  }
  .card-container {
    background: #fbfcfb;
    border: 2px solid #a3b899;
    border-radius: 16px;
    padding: 24px 32px;
    box-shadow: 0 4px 16px rgba(45, 74, 62, 0.08);
    display: inline-block;
    min-width: 500px;
    max-width: 860px;
    text-align: center;
  }
  .card-header {
    margin-bottom: 18px;
    padding-bottom: 10px;
    border-bottom: 1.5px solid #d5e2d8;
  }
  .card-title {
    font-size: 18px;
    font-weight: 700;
    color: #1e3324;
    letter-spacing: 0.5px;
  }
  .mermaid {
    font-size: 16.5px;
  }
  .node rect, .node circle, .node polygon {
    rx: 8px !important;
    ry: 8px !important;
    stroke-width: 1.8px !important;
  }
  .nodeLabel {
    font-size: 15.5px !important;
    font-weight: 600 !important;
    line-height: 1.5 !important;
  }
  .edgeLabel {
    font-size: 14px !important;
    font-weight: 600 !important;
    background-color: #ffffff !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    color: #4a6654 !important;
  }
</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    themeVariables: {
      primaryColor: '#eef4f0',
      primaryTextColor: '#2d4a3e',
      primaryBorderColor: '#a3b899',
      lineColor: '#6b8e23',
      secondaryColor: '#f9fbf9',
      tertiaryColor: '#ffffff',
      fontSize: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }
  });
</script>
</head>
<body>
  <div class="card-container" id="capture-target">
    ${title ? `<div class="card-header"><span class="card-title">🍵 心茶記 · ${title}</span></div>` : ''}
    <div class="mermaid">
${cleanCode}
    </div>
  </div>
</body>
</html>`;

  const absOutput = path.resolve(outputPath);
  const tmpHtml = path.resolve(path.dirname(absOutput), `_tmp_${Date.now()}_diagram.html`);
  fs.writeFileSync(tmpHtml, htmlContent, 'utf8');

  try {
    const cmd = `"${edgePath}" --headless --disable-gpu --screenshot="${absOutput}" --window-size=1000,900 "file:///${tmpHtml.replace(/\\/g, '/')}"`;
    execSync(cmd, { stdio: 'pipe' });
  } catch (err) {
    console.error('Edge screenshot error:', err.message);
  } finally {
    if (fs.existsSync(tmpHtml)) {
      try { fs.unlinkSync(tmpHtml); } catch (e) {}
    }
  }

  return fs.existsSync(absOutput);
}

function renderAllMermaidFromPost(postFilePath, targetSocialDir, isTraditional = true) {
  if (!fs.existsSync(postFilePath)) {
    throw new Error(`找不到文章檔案: ${postFilePath}`);
  }
  if (!fs.existsSync(targetSocialDir)) {
    fs.mkdirSync(targetSocialDir, { recursive: true });
  }

  const content = fs.readFileSync(postFilePath, 'utf8');
  const blocks = Array.from(content.matchAll(/```mermaid([\s\S]*?)```/g));

  if (blocks.length === 0) {
    return [];
  }

  console.log(`\n🎨 正在為文章產製 ${blocks.length} 張高清茶禪流程圖圖片...`);

  const generatedImages = [];
  blocks.forEach((m, idx) => {
    const rawCode = m[1].trim();
    const localizedCode = isTraditional ? s2tw(rawCode) : tw2s(rawCode);
    const imgName = `diagram_${idx + 1}.png`;
    const imgPath = path.join(targetSocialDir, imgName);

    // Extract diagram title from first node or direction
    const titleMatch = localizedCode.match(/\["([^"]+)"\]|\[([^\]]+)\]/);
    const diagramTitle = titleMatch ? (titleMatch[1] || titleMatch[2]).split(/<br\s*\/?>/)[0].replace(/[0-9\.、]/g, '').trim() : `流程架構 ${idx + 1}`;

    const ok = renderMermaidToPng(localizedCode, imgPath, { title: diagramTitle, isTraditional });
    if (ok) {
      console.log(`  ✅ 成功產製圖表: ${imgName} (${diagramTitle})`);
      generatedImages.push({
        index: idx + 1,
        title: diagramTitle,
        fileName: imgName,
        filePath: imgPath,
        code: localizedCode
      });
    } else {
      console.error(`  ❌ 產製圖表失敗: ${imgName}`);
    }
  });

  return generatedImages;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node render_mermaid_images.js <postPath> <targetSocialDir> [--sc]');
    process.exit(1);
  }
  const postPath = args[0];
  const targetDir = args[1];
  const isTraditional = !args.includes('--sc');
  renderAllMermaidFromPost(postPath, targetDir, isTraditional);
}

module.exports = {
  renderMermaidToPng,
  renderAllMermaidFromPost,
  findEdgePath
};
