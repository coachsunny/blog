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
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * 發送 Markdown 格式文字訊息
 */
async function sendMessage(text, options = {}) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] 尚未配置 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID，請檢查 .env 檔案');
    return null;
  }
  const payload = {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'Markdown',
    ...options
  };

  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('[Telegram] 發送訊息失敗:', err.message);
    return null;
  }
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
    await fetch(`${API_BASE}/editMessageText`, {
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

              // 智慧語意回應用
              const lower = userText.toLowerCase();
              if (lower === 'ok' || lower === '核准' || lower === '發布' || lower === '通過' || lower === '可以') {
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
                // 收到教練的觀點與指導
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
          }
        }
      }
    } catch (err) {
      // 網路暫時波動不中止，短暫延遲後繼續重試
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
