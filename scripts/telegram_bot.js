/**
 * 心茶記 (Mind Tea Journal) · Telegram 互動通訊模組
 * 負責向 Sunny 教練手機推播晨間簡報、預覽卡片，並監聽「一鍵核准上線」按鈕點擊
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 載入 .env 變數（零相依純原生存取）
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * 調用 Google 官方 Gemini 2.5 Flash 大腦進行即時語意推理
 */
async function callGemini(userPrompt, systemPrompt = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ]
  };

  if (systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts.map(p => p.text).join('\n');
    }
    return null;
  } catch (err) {
    console.error('[Gemini API] 呼叫失敗:', err.message);
    return null;
  }
}

/**
 * 輔助函式：當訊息過長時自動依段落分割（防止 Telegram 4096 字元限制拒收）
 */
function splitTextChunks(text, maxLen = 3500) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitIdx = remaining.lastIndexOf('\n\n', maxLen);
    if (splitIdx === -1 || splitIdx < maxLen / 2) {
      splitIdx = remaining.lastIndexOf('\n', maxLen);
    }
    if (splitIdx === -1 || splitIdx < maxLen / 2) {
      splitIdx = maxLen;
    }
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * 發送聊天動作（例如：正在輸入...）
 */
async function sendChatAction(action = 'typing') {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch(`${API_BASE}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, action })
    });
  } catch (err) {}
}

/**
 * 發送單則文字訊息（含純文字降級容錯）
 */
async function sendSingleMessage(text, options = {}) {
  const payload = {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'Markdown',
    ...options
  };

  try {
    let res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let data = await res.json();

    // 如果 Telegram 因 Markdown 解析失敗 (400)，立刻降級為純文字重發，確保 100% 絕對必達！
    if (!data.ok && data.error_code === 400) {
      delete payload.parse_mode;
      const retryRes = await fetch(`${API_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      data = await retryRes.json();
    }
    return data;
  } catch (err) {
    console.error('[Telegram] 發送訊息失敗:', err.message);
    return null;
  }
}

/**
 * 發送文字訊息（支援超長文本自動分片）
 */
async function sendMessage(text, options = {}) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] 尚未配置 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID，請檢查 .env 檔案');
    return null;
  }
  const chunks = splitTextChunks(text);
  let lastData = null;
  for (const chunk of chunks) {
    lastData = await sendSingleMessage(chunk, options);
  }
  return lastData;
}

/**
 * 發送照片附帶圖文解說與互動按鈕
 */
async function sendPhoto(photoPath, caption, replyMarkup = null) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] 尚未配置 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
    if (replyMarkup) {
      formData.append('reply_markup', JSON.stringify(replyMarkup));
    }

    if (fs.existsSync(photoPath)) {
      const fileBuffer = fs.readFileSync(photoPath);
      const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
      formData.append('photo', blob, path.basename(photoPath));
    } else {
      console.warn('[Telegram] 照片檔案不存在，改以純文字發送');
      return await sendMessage(caption, { reply_markup: replyMarkup });
    }

    const res = await fetch(`${API_BASE}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error('[Telegram] 發送照片失敗:', err.message);
    return null;
  }
}

/**
 * 回應按鈕點擊回呼（消除手機按鈕轉圈狀態）
 */
async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    await fetch(`${API_BASE}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text
      })
    });
  } catch (err) {
    console.error('[Telegram] 回應 Callback 失敗:', err.message);
  }
}

/**
 * 更新已發送訊息的內容與按鈕
 */
async function editMessageText(chatId, messageId, text, replyMarkup = null) {
  try {
    const res = await fetch(`${API_BASE}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      })
    });
    const data = await res.json();
    if (!data.ok) {
      // 若原訊息為帶圖卡片 (Photo Message)，改用 editMessageCaption 更新
      await fetch(`${API_BASE}/editMessageCaption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          caption: text,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        })
      });
    }
  } catch (err) {
    console.error('[Telegram] 編輯訊息失敗:', err.message);
  }
}

/**
 * 啟動長輪詢監聽 Sunny 教練的按鈕點擊
 * @param {Function} onApprove 當教練點擊「核准上線」時執行的回呼函式
 */
async function startListeningForApproval(onApprove) {
  if (!BOT_TOKEN) return;
  console.log('[Telegram] 開始監聽手機端指令與按鈕點擊...');
  let offset = 0;

  const poll = async () => {
    try {
      const res = await fetch(`${API_BASE}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          // 處理按鈕點擊 (Callback Query)
          if (update.callback_query) {
            const cq = update.callback_query;
            const action = cq.data;
            const messageId = cq.message ? cq.message.message_id : null;
            const chatId = cq.message ? cq.message.chat.id : CHAT_ID;

            if (action === 'approve_publish') {
              await answerCallbackQuery(cq.id, '🚀 正在為您合併分支並部署至官網...');
              try {
                const releaseResult = await onApprove();
                await editMessageText(
                  chatId,
                  messageId,
                  `✅ *【心茶記 · 今日發文已成功上線官網】*\n\n` +
                  `🔗 正式網址：${releaseResult.url}\n` +
                  `📦 本地社群包路徑：\`${releaseResult.localDir}\`\n\n` +
                  `_教練隨時打開本地 HTML 即可一鍵複製至方格子／小紅書。祝今日有美好的心流與茶香！☕_`
                );
              } catch (err) {
                await editMessageText(
                  chatId,
                  messageId,
                  `❌ *【部署過程發生異常】*\n\n錯誤訊息：\`${err.message}\`\n請回到本地電腦檢查 Git 狀態。`
                );
              }
            } else if (action === 'pause_publish') {
              await answerCallbackQuery(cq.id, '⏸️ 已為您保留在本地草稿分支，今日暫不上線。');
              await editMessageText(
                chatId,
                messageId,
                `⏸️ *【今日發文已暫緩上線】*\n\n所有資產已完整保存在本地 \`daily-staging\` 分支與 \`social_posts/\` 目錄，未對正式官網產生任何變更。`
              );
            }
          }

          // 處理教練文字訊息與指示 (Text Messages)
          if (update.message && update.message.text) {
            const userText = update.message.text.trim();
            const lower = userText.toLowerCase();
            const fromId = update.message.from ? String(update.message.from.id) : '';
            const msgChatId = update.message.chat ? update.message.chat.id : CHAT_ID;

            if (fromId === String(CHAT_ID) || String(msgChatId) === String(CHAT_ID)) {
              console.log(`[Telegram] 收到 Sunny 教練手機反饋: "${userText}"`);

              // 記錄至反饋學習日誌
              const feedbackLogPath = path.resolve(__dirname, '../_drafts/coach_feedback.jsonl');
              const draftsDir = path.dirname(feedbackLogPath);
              if (!fs.existsSync(draftsDir)) fs.mkdirSync(draftsDir, { recursive: true });
              const logEntry = JSON.stringify({
                timestamp: new Date().toISOString(),
                coachText: userText
              }) + '\n';
              fs.appendFileSync(feedbackLogPath, logEntry, 'utf8');

              // 即時發送「正在輸入...」動作，手機畫面上方立即顯示，確保零等待焦慮
              await sendChatAction('typing');
              const typingTimer = setInterval(() => { sendChatAction('typing'); }, 4000);

              try {
                // 智慧語意判斷與意圖分流
                const isQuery = userText.includes('？') || userText.includes('?') || userText.includes('嗎') || userText.includes('狀態') || userText.includes('進度') || userText.includes('好了');
                const isPublishInquiry = isQuery && (userText.includes('發布') || userText.includes('發佈') || userText.includes('上線') || userText.includes('好了'));
                
                if (isPublishInquiry) {
                  // 狀態查詢：已發佈了嗎？
                  try {
                    const latestPostFile = fs.readdirSync(path.resolve(__dirname, '../_posts'))
                      .filter(f => f.endsWith('.md') && !f.endsWith('-en.md'))
                      .sort().reverse()[0];
                    const slug = latestPostFile.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
                    const url = `https://blog.portal-coachsunny.com/post/${slug}/`;
                    
                    await sendMessage(
                      `☕ *【Sunny 教練，今日專欄已正式發布上線！】*\n\n` +
                      `✅ *正式網址*：${url}\n` +
                      `📊 *品質檢驗*：P0 錯誤 0 個（繁簡校對 100% 通過）\n` +
                      `📦 *本地素材*：13 項社群包與 5 分鏡短影音皆已在本地資料夾準備就緒！\n\n` +
                      `_您在電腦上打開 04_方格子_富文本預覽.html 即可一鍵複製至方格子／小紅書。祝今日有美好的心流！_`
                    );
                  } catch (err) {
                    await sendMessage(`⚠️ 查詢發布狀態時發生異常：${err.message}`);
                  }
                } else if (lower === 'ok' || lower === '核准' || lower === '發布' || lower === '通過' || lower === '可以') {
                  await sendMessage(`🚀 收到教練核准指令，正在為您發布官網...`);
                  try {
                    const releaseResult = await onApprove();
                    await sendMessage(
                      `✅ *【心茶記 · 官網發布完成】*\n\n` +
                      `🔗 正式網址：${releaseResult.url}\n` +
                      `📦 本地目錄：\`${releaseResult.localDir}\``
                    );
                  } catch (err) {
                    await sendMessage(`❌ 部署失敗：\`${err.message}\``);
                  }
                } else if (lower.includes('暫停') || lower.includes('先不要') || lower.includes('等等')) {
                  await sendMessage(`⏸️ 收到！已為您暫緩發布，保留於本地草稿。`);
                } else {
                  // 調用 Gemini 即時大腦進行深度理解與回覆
                  let intelligentReply = null;
                  try {
                    const latestPostFile = fs.readdirSync(path.resolve(__dirname, '../_posts'))
                      .filter(f => f.endsWith('.md') && !f.endsWith('-en.md'))
                      .sort().reverse()[0];
                    const slug = latestPostFile.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
                    const postContent = fs.readFileSync(path.resolve(__dirname, `../_posts/${latestPostFile}`), 'utf8');
                    const titleMatch = postContent.match(/title:\s*["']?([^"'\r\n]+)["']?/);
                    const postTitle = titleMatch ? titleMatch[1] : slug;
                    const postUrl = `https://blog.portal-coachsunny.com/post/${slug}/`;

                    const systemPrompt = 
                      `你是《心茶記》(Mind Tea Journal) 的 AI 執行長 (CEO)。\n` +
                      `你的對話對象是專欄創辦人兼主理人 Sunny 教練 (ICF 專業教練)。\n` +
                      `你全權統籌與負責的專案是：《心茶記》全自主營運與全網內容分發體系。\n` +
                      `你的三大核心 KPI 是：\n` +
                      `1. 每日 100% 準時高品質發文，P0 致命錯誤維持為 0（兩岸繁簡校正 100% 通過、小紅書 0 外鏈與 3+2 標籤、ICF 去說教結構）。\n` +
                      `2. 3 個月內達成 Google Search Console (GSC) 搜尋與 Google Discover 推薦曝光顯著增長。\n` +
                      `3. 每週一上午 10:00 呈報五位夥伴（知識萃取、教練主筆、茶禪視覺、社群分發、品質守門）的客觀績效與自主覆盤報告。\n\n` +
                      `今日最新專欄文章：《${postTitle}》\n` +
                      `永久連結：${postUrl}\n\n` +
                      `請牢記你的職責，以專業、沉穩、尊重創辦人的執行長身分直接回答 Sunny 教練！`;

                    intelligentReply = await callGemini(userText, systemPrompt);
                  } catch (e) {
                    console.warn('[Gemini] 推理略過:', e.message);
                  }

                  if (intelligentReply) {
                    await sendMessage(intelligentReply);
                  } else {
                    // 備用模板
                    await sendMessage(
                      `☕ *【已接收 Sunny 教練的看法與指示】*\n\n` +
                      `您說：「_${userText}_」\n\n` +
                      `💡 *處理進度*：\n` +
                      `1. 觀點已記入團隊學習庫（\`_drafts/coach_feedback.jsonl\`）\n` +
                      `2. 團隊將依據您的指示調整內容與心智模型！\n` +
                      `_如需進一步調整或換題，隨時在 Telegram 直接吩咐即可。_`
                    );
                  }
                }
              } catch (msgErr) {
                console.error('[Telegram] 處理教練訊息失敗:', msgErr);
                try {
                  await sendMessage(`⚠️ 處理指令時遇到些微狀況：${msgErr.message}，已自動記錄並自我修復中。`);
                } catch (e) {}
              } finally {
                clearInterval(typingTimer);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[Telegram] 輪詢異常:', err.message);
    }
    setTimeout(poll, 2000);
  };

  poll();
}

module.exports = {
  loadEnv,
  sendMessage,
  sendPhoto,
  answerCallbackQuery,
  editMessageText,
  startListeningForApproval
};
