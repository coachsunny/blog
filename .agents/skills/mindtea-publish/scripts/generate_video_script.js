const fs = require('fs');
const path = require('path');

/**
 * 5 Short Video Archetypes for Mind Tea Journal (心茶記 30秒短影音五大風格模型)
 */
const VIDEO_ARCHETYPES = {
  STYLE_1: {
    id: 'STYLE_1',
    name: '風格 1：教練現場微對話型',
    desc: '沉浸偷聽感，以真實教練對談切入，直擊心理防禦',
    bgm: '低音量溫暖木吉他單音，營造私密沉靜感'
  },
  STYLE_2: {
    id: 'STYLE_2',
    name: '風格 2：身心覺察引導型',
    desc: '30秒數位冥想與 ASMR，引導讀者身體落地與深呼吸',
    bgm: '空靈水流聲、注水聲與輕柔磬音，白噪音撫平焦慮'
  },
  STYLE_3: {
    id: 'STYLE_3',
    name: '風格 3：認知翻轉暴擊型',
    desc: '打破常識的顛覆性洞察，直切深層心理機制',
    bgm: '具備深沉頓挫感的沉思鋼琴單音，營造清醒頓悟感'
  },
  STYLE_4: {
    id: 'STYLE_4',
    name: '風格 4：職場日常鏡像型',
    desc: '生活與職場溝通困境高精度還原，引發強烈共鳴',
    bgm: '微弱鍵盤聲漸轉為溫潤柔和白噪音'
  },
  STYLE_5: {
    id: 'STYLE_5',
    name: '風格 5：東方茶禪哲思型',
    desc: '借茶器與自然物象抽離維度，溫潤金句與生命相遇',
    bgm: '空靈悠遠古琴單音，伴隨水流聲與溫暖弦樂微光漸入'
  }
};

/**
 * Determine best matching archetype based on title and content keywords
 */
function detectArchetype(title, body) {
  const combined = (title + ' ' + body.slice(0, 500)).toLowerCase();

  if (/身體|生理|耗竭|緊繃|呼吸|肩膀|牙關|能量|疲憊|疲勞/.test(combined)) {
    return VIDEO_ARCHETYPES.STYLE_2;
  }
  if (/螢幕|屏幕|會議|媒介|文字|訊息|黑屏|視訊|視頻|工作|職場/.test(combined)) {
    return VIDEO_ARCHETYPES.STYLE_4;
  }
  if (/對話|訪客|sunny|問我|回答|對談|聊天|請教/.test(combined)) {
    return VIDEO_ARCHETYPES.STYLE_1;
  }
  if (/不是|敵人|反直覺|錯誤|憤怒|防衛|防禦|真相|常識|盲區/.test(combined)) {
    return VIDEO_ARCHETYPES.STYLE_3;
  }
  return VIDEO_ARCHETYPES.STYLE_5;
}

/**
 * Generate a complete 30-second video script file content
 */
function createVideoScriptContent(titleTc, bodyTc, postSlug) {
  const archetype = detectArchetype(titleTc, bodyTc);

  // Extract clean sentences from the body
  const rawParagraphs = bodyTc
    .split(/\r?\n\r?\n/)
    .map(p => p.trim())
    .filter(p => p.length > 20 && !p.startsWith('#') && !p.startsWith('---') && !p.startsWith('>'));

  const leadP = rawParagraphs[0] || '';
  const secondP = rawParagraphs[1] || '';

  // Specific bespoke handling for integration and key factor posts
  let scriptContent = '';

  if (postSlug.includes('communication-factors-integration')) {
    scriptContent = `【心茶記 · 30秒短影音分鏡腳本】
篇名：${titleTc}
主題：開口前的「三秒入定法」
短影音風格：${archetype.name}（${archetype.desc}）
規格時長：9:16 直式高清（1080x1920）｜ 嚴格 30 秒 ｜ 旁白總字數：106 字（語速約 3.5 字/秒）
配樂與音效：${archetype.bgm}

============================================================
【一、 30秒精準分鏡腳本表】
============================================================

▶ 00:00 - 00:04（4秒）【黃金抓手 Hook：直擊痛點】
畫面：[特寫] 一隻緊緊握成拳頭的手，指節微白緊繃；鏡頭緩緩微距切換到原木茶几上一只未動的茶杯。
字卡（居中大字）：好好說一句話，為什麼這麼難？
旁白：好好說話為什麼這麼難？因為我們總想證明自己「贏」。
音效：沉悶的低音鋼琴單音，營造對峙緊繃感。

▶ 00:04 - 00:13（9秒）【核心洞察 Insight：三秒定錨】
畫面：[慢動作] 緊握的拳頭慢慢鬆開，掌心朝上平放；隨後一注溫熱茶湯緩緩注入青瓷杯中，水氣氤氳升起。
字卡（動畫條列）：
【開口前的三秒留白】
一、鬆開牙關
二、校準意圖
旁白：開口前，請留白三秒：第一秒，鬆開咬緊的牙關；第二秒問自己：我是想爭輸贏，還是想解決問題？
音效：空靈古琴單音響起，伴隨清脆細膩的茶水注杯水流聲。

▶ 00:13 - 00:22（9秒）【微步轉向 Shift：點亮好奇】
畫面：[中景推鏡] 茶席對坐的留白視角，窗外微風吹拂綠竹樹影，室內茶煙裊裊，氛圍從對立轉為澄澈寧靜。
字卡（居中強調）：
三、點亮好奇：
他的世界正在經歷什麼？
旁白：第三秒點亮好奇：看著對方的眼睛，去聽聽他的世界，正在經歷什麼。
音效：溫暖的提琴微光漸入，氛圍豁然開朗。

▶ 00:22 - 00:30（8秒）【溫潤收官 Outro：哲思昇華】
畫面：[定格漸隱] 茶霧散開，畫面中央浮現古樸典雅的《心茶記》木質印章 LOGO 與文章專欄指引。
字卡（詩意排版）：
所有真實的人生，皆在相遇之中。
—— 心茶記 Sunny
旁白：所有真實的人生，皆在相遇之中。搜尋《心茶記》，找回對話的初心。
音效：音樂悠揚漸弱，餘韻沉降。

============================================================
【二、 旁白純文字（供 TTS 語音合成一鍵複製）】
============================================================
好好說話為什麼這麼難？因為我們總想證明自己「贏」。開口前，請留白三秒：第一秒，鬆開咬緊的牙關；第二秒問自己：我是想爭輸贏，還是想解決問題？第三秒點亮好奇：看著對方的眼睛，去聽聽他的世界，正在經歷什麼。所有真實的人生，皆在相遇之中。搜尋《心茶記》，找回對話的初心。

============================================================
【三、 AI 畫面生成提示詞（Visual Prompts）】
============================================================
Scene 1 (00-04s): Macro close-up shot of a human hand tightly clenched into a white-knuckled fist resting beside an untouched celadon ceramic teacup on an aged walnut tea table, tense shadows, cinematic lighting, f/1.8.
Scene 2 (04-13s): Slow motion shot of the hand slowly unfurling, palm facing up in gentle surrender; hot amber tea gently pouring into a handmade ceramic bowl, delicate steam rising, soft morning golden sidelight, tranquil.
Scene 3 (13-22s): Medium shot of a serene Zen tea room setup for two, empty wooden stools, bamboo window blinds with soft wind moving green leaves outside, warm morning sunbeams cutting through fragrant steam, deep emotional peace.
Scene 4 (22-30s): Clean, minimalist Zen aesthetic background, warm oak wood grain texture, soft bokeh highlights, elegant negative space for typography.
Constraint: ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO WATERMARKS.
`;
  } else {
    // Dynamic generation based on detected archetype
    const shortTitle = titleTc.split(/[:：]/)[0].trim();
    const coreHook = `為什麼在最在乎的人面前，我們反而最容易說出帶刺的話？`;
    const coreInsight = leadP.slice(0, 42).replace(/[\r\n]+/g, ' ') || '溝通的暗礁，往往不是立場對立，而是我們把自己的尺，硬套在對方的生命裡。';
    const coreShift = '試著在開口前深呼吸一次，把「你為什麼」換成「我很想聽聽看」。';
    const coreOutro = `開口有光，落座有溫。搜尋《心茶記》，找回相遇的初心。`;

    const fullVoiceover = `${coreHook}${coreInsight}${coreShift}${coreOutro}`;

    scriptContent = `【心茶記 · 30秒短影音分鏡腳本】
篇名：${titleTc}
主題：${shortTitle}
短影音風格：${archetype.name}（${archetype.desc}）
規格時長：9:16 直式高清（1080x1920）｜ 嚴格 30 秒 ｜ 旁白總字數：約 100 字（語速約 3.3 字/秒）
配樂與音效：${archetype.bgm}

============================================================
【一、 30秒精準分鏡腳本表】
============================================================

▶ 00:00 - 00:04（4秒）【黃金抓手 Hook：直擊痛點】
畫面：[特寫] 晨光透過窗簾灑在粗陶茶杯上，熱氣細微升起，畫面帶有電影般淺景深。
字卡（居中大字）：${shortTitle}
旁白：${coreHook}
音效：細微環境白噪音，低沉鋼琴單音切入。

▶ 00:04 - 00:13（9秒）【核心洞察 Insight：機制拆解】
畫面：[慢推鏡頭] 手持茶壺緩緩注入沸水，茶葉在透明蓋碗中輕柔翻滾、舒展開來。
字卡（重點提煉）：
理解不是說服，
而是照見彼此的真實。
旁白：${coreInsight}
音效：清澈水流注入聲，空靈古琴單音隨之響起。

▶ 00:13 - 00:22（9秒）【微步轉向 Shift：微步實驗】
畫面：[中景景深] 溫暖原木茶几上一本翻開的筆記本與鋼筆，茶香氤氳，節奏舒緩沉降。
字卡（微行動指引）：
開口前留白三秒，
好奇看見真實的他。
旁白：${coreShift}
音效：溫暖弦樂漸入，撫平焦慮。

▶ 00:22 - 00:30（8秒）【溫潤收官 Outro：哲思昇華】
畫面：[定格漸隱] 茶氣散開，浮現《心茶記》極簡印章風格 LOGO 與專欄指引。
字卡（收尾金句）：
開口有光，落座有溫。
—— 心茶記 Sunny
旁白：${coreOutro}
音效：音樂自然淡出，留白收尾。

============================================================
【二、 旁白純文字（供 TTS 語音合成一鍵複製）】
============================================================
${fullVoiceover}

============================================================
【三、 AI 畫面生成提示詞（Visual Prompts）】
============================================================
Scene 1 (00-04s): Cinematic close up of a handmade ceramic tea cup on natural cedar wood table, warm morning sunbeams, shallow depth of field.
Scene 2 (04-13s): Slow motion hot water pouring into tea pot, tea leaves unfurling, amber glow, tranquil meditative atmosphere.
Scene 3 (13-22s): Minimalist Zen interior, wooden table, bamboo blinds, warm soft lighting, quiet contemplative room.
Scene 4 (22-30s): Elegant dark slate tea tray texture with smooth negative space, soft ambient warm highlights.
Constraint: ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO WATERMARKS.
`;
  }

  return scriptContent;
}

module.exports = {
  VIDEO_ARCHETYPES,
  detectArchetype,
  createVideoScriptContent
};
