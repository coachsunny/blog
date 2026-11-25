/**
 * Telegram 連線測試與 Chat ID 偵測小工具
 * 執行方式：node scripts/test_telegram.js
 */

const { loadEnv, sendMessage } = require('./telegram_bot');

loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function testConnection() {
  console.log('=== 心茶記 · Telegram 機器人連線檢測 ===\n');

  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') {
    console.error('❌ 請先在 d:\\blog\\.env 填寫正確的 TELEGRAM_BOT_TOKEN');
    console.log('👉 取得方式：在 Telegram 搜尋 @BotFather，輸入 /newbot，依提示取得 Token。\n');
    process.exit(1);
  }

  // 1. 驗證 Bot 身分
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      console.error('❌ Bot Token 驗證失敗：', data.description);
      process.exit(1);
    }
    console.log(`✅ 機器人身分驗證成功：@${data.result.username} (${data.result.first_name})`);
  } catch (err) {
    console.error('❌ 連線 Telegram API 失敗：', err.message);
    process.exit(1);
  }

  // 2. 若未填寫 CHAT_ID，嘗試自動偵測
  if (!CHAT_ID || CHAT_ID === 'your_chat_id_here') {
    console.log('\n🔍 正在尋找您的 Telegram Chat ID...');
    console.log('👉 請在手機 Telegram 打開您的機器人，並發送任意一句話（例如「早安」）！');
    
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`);
      const data = await res.json();
      if (data.ok && data.result.length > 0) {
        const lastMsg = data.result[data.result.length - 1];
        const from = lastMsg.message ? lastMsg.message.from : (lastMsg.channel_post ? lastMsg.channel_post.chat : null);
        if (from) {
          console.log(`\n🎉 成功找到您的 Chat ID：${from.id} (${from.first_name || 'Sunny'})`);
          console.log(`👉 請將以下這行加入 d:\\blog\\.env：\nTELEGRAM_CHAT_ID=${from.id}\n`);
          return;
        }
      }
      console.log('\n⚠️ 目前尚未收到您的訊息。請在 Telegram 傳送任意一句話給機器人後，重新執行此腳本。');
    } catch (err) {
      console.error('偵測 Chat ID 失敗：', err.message);
    }
    return;
  }

  // 3. 測試發送晨間問候
  console.log(`\n📤 正在向 Chat ID (${CHAT_ID}) 發送測試訊息...`);
  const testMsg = 
    `☕ *【心茶記 · 晨間守護機器人連線成功】*\n\n` +
    `Sunny 教練早安！此頻道已成功與您的本地工作站綁定。\n` +
    `每日清晨 07:30 團隊將自動預備發文，並於 08:00 推送簡報與核准按鈕至此！`;

  const sendRes = await sendMessage(testMsg);
  if (sendRes && sendRes.ok) {
    console.log('🎉 測試訊息發送成功！請檢查您的手機 Telegram。');
  } else {
    console.error('❌ 發送失敗：', sendRes);
  }
}

testConnection();
