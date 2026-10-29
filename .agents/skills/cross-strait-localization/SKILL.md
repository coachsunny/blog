---
name: cross-strait-localization
description: >-
  Use this skill when translating, localizing, or linting content between Taiwan Traditional Chinese (zh-TW) and Mainland Simplified Chinese (zh-CN). Especially required when generating or verifying social media posts (e.g. ensuring 方格子 is 100% Traditional Chinese with Taiwan phrasing, verifying 小紅書 has zero external links, and checking domain URLs).
---

# 兩岸語彙雙向在地化與發布防呆檢驗 (Cross-Strait Localization & Linter)

專門為《心茶記》(Mind Tea Journal) 專欄設計之繁簡雙向語彙轉換、兩岸標點標準轉換、以及發布前社群資產防呆檢驗工具。

---

## 核心功能

1. **雙向語彙與標點在地化 (`convert_text.js`)**：
   - **簡體轉台灣繁體 (s2tw)**：
     - 自動置換台灣慣用詞（如：`視頻` $\rightarrow$ `影片`、`信息` $\rightarrow$ `訊息`、`項目` $\rightarrow$ `專案`、`屏幕` $\rightarrow$ `螢幕`、`算法` $\rightarrow$ `演算法`、`反饋` $\rightarrow$ `回饋`、`復盤` $\rightarrow$ `覆盤`）。
     - 轉換中國彎引號（`“ ”`、`‘ ’`）為台灣教育部直角引號（`「 」`、`『 』`）。
     - 轉換簡體字元為標準繁體字。
   - **繁體轉大陸簡體 (tw2s)**：
     - 自動置換大陸慣用詞（如：`影片` $\rightarrow$ `视频`、`專案` $\rightarrow$ `项目`、`螢幕` $\rightarrow$ `屏幕`）。
     - 轉換引號為彎引號（`“ ”`）。
2. **多平台發布防呆檢驗 (`lint_social_posts.js`)**：
   - **方格子 100% 繁體字檢驗**：基於教育部常用國字與 OpenCC 簡體字庫比對，嚴格禁止簡體字（如 `经`、`觉`、`话`、`来` 等）及大陸未在地化詞彙出現在 `04_方格子.*`。
   - **小紅書 零外部連結檢驗**：確保 `06_小紅書.txt` 嚴禁任何超連結（`http://`、`https://`、`.com`、`.io`），並強制包含「心茶記 Sunny」品牌搜尋指引。
   - **網域防臆測檢驗**：全域掃描禁止出現臆測網域（如 `sunnycoach.com`、`coachsunny.com`），確保永久連結嚴格符合 `https://coachsunny.github.io/blog/post/<slug>/`。
   - **資產完整性檢驗**：驗證 12 項必備社群資產無一遺漏且無 0-byte 空檔。

---

## 常用指令與操作方式

### 1. 執行社群貼文品質檢驗 (Linter)

檢驗單一特定文章目錄：
```bash
node .agents/skills/cross-strait-localization/scripts/lint_social_posts.js 2026-10-18_物理環境與溝通媒介
```

檢驗全站所有社群貼文目錄：
```bash
node .agents/skills/cross-strait-localization/scripts/lint_social_posts.js --all
```

> **檢驗結果標準**：
> - `[PASS]`：通過所有檢查，可安心發布。
> - `[WARN]`：提示建議（如封面備份路徑或搜尋詞提醒）。
> - `[FAIL]`：嚴重錯誤（如方格子出現簡體字、小紅書違規外鏈、錯誤網域），必須修正後方可上線。

### 2. 進行文字或檔案雙向轉換 (`convert_text.js`)

在程式碼中調用：
```javascript
const { s2tw, tw2s } = require('./.agents/skills/cross-strait-localization/scripts/convert_text.js');

// 簡轉繁在地化
const traditionalTaiwanText = s2tw(simplifiedArticle);

// 繁轉簡在地化
const mainlandSimplifiedText = tw2s(traditionalText);
```

命令列轉換檔案：
```bash
# 將簡體 Markdown 轉換為 100% 台灣繁體
node .agents/skills/cross-strait-localization/scripts/convert_text.js --mode s2tw --input draft.md --output 04_方格子.md
```

---

## 依賴與資源路徑

- 詞彙對照表：[`references/vocabulary_mapping.json`](./references/vocabulary_mapping.json)
- 簡體字庫與 OpenCC 字典：[`references/`](./references/)
- 轉換腳本：[`scripts/convert_text.js`](./scripts/convert_text.js)
- 檢驗器：[`scripts/lint_social_posts.js`](./scripts/lint_social_posts.js)
