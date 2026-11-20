const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { s2tw, tw2s } = require('../../cross-strait-localization/scripts/convert_text.js');

function findFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch (e) {}

  const wingetRoot = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
  if (fs.existsSync(wingetRoot)) {
    const packages = fs.readdirSync(wingetRoot);
    const ffmpegPkg = packages.find(p => p.toLowerCase().includes('ffmpeg'));
    if (ffmpegPkg) {
      const candidate = path.join(wingetRoot, ffmpegPkg, 'ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe');
      if (fs.existsSync(candidate)) return candidate;

      const binDir = path.join(wingetRoot, ffmpegPkg);
      const walk = (d) => {
        const files = fs.readdirSync(d, { withFileTypes: true });
        for (const f of files) {
          const full = path.join(d, f.name);
          if (f.isDirectory()) {
            const found = walk(full);
            if (found) return found;
          } else if (f.name.toLowerCase() === 'ffmpeg.exe') {
            return full;
          }
        }
        return null;
      };
      const found = walk(binDir);
      if (found) return found;
    }
  }

  throw new Error('找不到 FFmpeg 執行檔，請確認已安裝 FFmpeg。');
}

function findEdgeTTS() {
  try {
    execSync('edge-tts --version', { stdio: 'ignore' });
    return 'edge-tts';
  } catch (e) {}

  const pythonScriptDir = path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python312/Scripts');
  const edgeTtsExe = path.join(pythonScriptDir, 'edge-tts.exe');
  if (fs.existsSync(edgeTtsExe)) {
    return edgeTtsExe;
  }
  return null;
}

/**
 * Synthesize voiceover using Edge Neural TTS
 * 依作者 Sunny 性別規範：嚴格限定使用男性沉穩教練音 (zh-TW-YunJheNeural)
 * 參數：語速 -15% 留白節奏、音調 -5Hz 沉穩安定
 */
function synthesizeVoice(text, outAudioPath) {
  const pyScript = path.join(__dirname, 'synthesize_voice.py');
  const vttPath = outAudioPath.replace(/\.[^.]+$/, '.vtt');
  const tmpTextFile = outAudioPath.replace(/\.[^.]+$/, '.text.tmp');

  const textForTts = tw2s(text);
  const utf8Env = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
  const edgeTts = findEdgeTTS();
  if (edgeTts) {
    console.log('🎤 使用微軟自然神經語音 CLI (zh-TW-YunJheNeural，作者 Sunny 男性沉穩教練音質)...');
    fs.writeFileSync(tmpTextFile, textForTts, 'utf8');
    try {
      // 依作者性別規範：嚴格限定微軟自然神經教練男聲 zh-TW-YunJheNeural
      // 留白語速 -15%；微軟 API 不支援同時調整 rate 與 pitch，pitch 保持自然頻率以防 NoAudioReceived
      const cmd = `"${edgeTts}" --voice zh-TW-YunJheNeural --rate="-15%" -f "${tmpTextFile}" --write-media "${outAudioPath}" --write-subtitles "${vttPath}"`;
      execSync(cmd, { stdio: 'inherit', env: utf8Env });
      if (fs.existsSync(outAudioPath) && fs.statSync(outAudioPath).size > 1000) {
        return;
      }
    } catch (err) {
      console.warn('⚠️ edge-tts CLI 失敗，嘗試調用 Python 腳本...', err.message);
    } finally {
      if (fs.existsSync(tmpTextFile)) {
        fs.unlinkSync(tmpTextFile);
      }
    }
  }

  if (fs.existsSync(pyScript)) {
    console.log('🎤 使用微軟自然神經語音 Python 腳本 (zh-TW-YunJheNeural)...');
    fs.writeFileSync(tmpTextFile, textForTts, 'utf8');
    try {
      const cmd = `python "${pyScript}" "${tmpTextFile}" "${outAudioPath}" "${vttPath}"`;
      execSync(cmd, { stdio: 'inherit', env: utf8Env });
      return;
    } catch (err) {
      console.warn('⚠️ Python 腳本失敗，切換至 SAPI...', err.message);
    } finally {
      if (fs.existsSync(tmpTextFile)) {
        fs.unlinkSync(tmpTextFile);
      }
    }
  }

  if (!fs.existsSync(outAudioPath) || fs.statSync(outAudioPath).size < 1000) {
    throw new Error('微軟自然神經語音合成失敗 (zh-TW-YunJheNeural)。請檢查網絡連線或重試，嚴禁使用未授權的女聲或機械音！');
  }
}

function vttTimeToAss(vttTime) {
  const clean = vttTime.replace(',', '.');
  const parts = clean.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseFloat(parts[2]);
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

/**
 * Automatically wrap CJK text to fit 9:16 vertical video width (1080px)
 * Breaks text cleanly into 1 or at most 2 balanced lines without dangling punctuation
 */
function wrapCjkText(text, maxChars = 15) {
  if (!text) return '';
  text = text.replace(/\\N/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= maxChars) return text;

  // Find punctuation near midpoint
  const puncRegex = /([，；：。？！』」])/g;
  let matches = [];
  let m;
  while ((m = puncRegex.exec(text)) !== null) {
    matches.push(m.index + 1);
  }

  if (matches.length > 0) {
    const half = Math.floor(text.length / 2);
    // Find split point closest to center but ensuring neither half is < 5 chars
    const validSplits = matches.filter(pos => pos >= 5 && (text.length - pos) >= 4);
    if (validSplits.length > 0) {
      const best = validSplits.reduce((prev, curr) => Math.abs(curr - half) < Math.abs(prev - half) ? curr : prev);
      const p1 = text.slice(0, best).trim();
      const p2 = text.slice(best).trim();
      return `${p1}\\N${p2}`;
    }
  }

  // Fallback: split near half without breaking quote pairs
  const half = Math.floor(text.length / 2);
  const p1 = text.slice(0, half).trim();
  const p2 = text.slice(half).trim();
  return `${p1}\\N${p2}`;
}

/**
 * Generate .ass subtitle file (dynamically from VTT if available)
 */
function createAssSubtitles(assPath, vttPath) {
  let dialogueEvents = '';

  if (vttPath && fs.existsSync(vttPath)) {
    const vttContent = fs.readFileSync(vttPath, 'utf8');
    const blocks = vttContent.trim().split(/\r?\n\r?\n/);

    for (const b of blocks) {
      const lines = b.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const timeLine = lines.find(l => l.includes('-->'));
      if (!timeLine) continue;
      const [start, end] = timeLine.split('-->').map(s => s.trim());
      const rawText = lines.slice(lines.indexOf(timeLine) + 1).join(' ').trim();
      if (!rawText) continue;
      const text = s2tw(wrapCjkText(rawText, 16));
      dialogueEvents += `Dialogue: 0,${vttTimeToAss(start)},${vttTimeToAss(end)},Default,,0,0,0,,${text}\n`;
    }

    // Always include top branding watermark
    dialogueEvents = `Dialogue: 0,0:00:00.00,0:05:00.00,Watermark,,0,0,0,,🍵 心茶記 · 晨光微光 ｜ 30秒心智沈澱\n` + dialogueEvents;
  }

  if (!dialogueEvents) {
    dialogueEvents = `Dialogue: 0,0:00:00.00,0:00:34.00,Watermark,,0,0,0,,🍵 心茶記 · 晨光微光 ｜ 30秒心智沈澱
Dialogue: 0,0:00:00.00,0:00:04.50,TitleCard,,0,0,0,,好好說一句話，為什麼這麼難？
Dialogue: 0,0:00:00.00,0:00:04.50,Default,,0,0,0,,因為我們總想證明自己「贏」
Dialogue: 0,0:00:04.50,0:00:14.00,TitleCard,,0,0,0,,【開口前的三秒留白】
Dialogue: 0,0:00:04.50,0:00:09.00,Default,,0,0,0,,第一秒，鬆開咬緊的牙關
Dialogue: 0,0:00:09.00,0:00:14.00,Default,,0,0,0,,第二秒問自己：\\N我是想爭輸贏，還是想解決問題？
Dialogue: 0,0:00:14.00,0:00:23.50,TitleCard,,0,0,0,,【第三秒：點亮好奇】
Dialogue: 0,0:00:14.00,0:00:23.50,Default,,0,0,0,,看著對方的眼睛，\\N去聽聽他的世界正在經歷什麼
Dialogue: 0,0:00:23.50,0:00:34.00,TitleCard,,0,0,0,,所有真實的人生，皆在相遇之中
Dialogue: 0,0:00:23.50,0:00:34.00,Default,,0,0,0,,搜尋《心茶記》，找回對話的初心
`;
  }

  const assContent = `[Script Info]
Title: Mind Tea Journal Short Video
ScriptType: v4.00+
WrapStyle: 1
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft JhengHei,54,&H00FFFFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,2,0,1,3.5,2,2,60,60,180,1
Style: Watermark,Microsoft JhengHei,52,&H00EAF2EC,&H000000FF,&H00182C1F,&H80000000,-1,0,0,0,100,100,2,0,1,3.2,2,8,40,40,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogueEvents}`;

  fs.writeFileSync(assPath, assContent, 'utf8');
}

/**
 * Render complete 9:16 vertical short video (Immersive Full-Screen Presentation)
 */
function renderShortVideo(targetFolder) {
  const ffmpeg = findFFmpeg();
  const folder = path.resolve(targetFolder);

  const coverPath = path.join(folder, 'cover.jpg').replace(/\\/g, '/');
  let voicePath = path.join(folder, 'voiceover_coach.mp3').replace(/\\/g, '/');
  const assPath = path.join(folder, 'subtitles.ass').replace(/\\/g, '/');
  const outVideo = path.join(folder, 'short_video.mp4').replace(/\\/g, '/');
  const scriptPath = path.join(folder, '08_短視頻腳本.txt');

  if (!fs.existsSync(coverPath)) {
    throw new Error(`找不到封面圖片: ${coverPath}`);
  }

  // 1. Synthesize voice if not exists
  if (!fs.existsSync(voicePath)) {
    const fallbackWav = path.join(folder, 'voiceover.wav').replace(/\\/g, '/');
    if (fs.existsSync(fallbackWav)) {
      voicePath = fallbackWav;
    } else {
      console.log('🎤 正在生成 AI 自然神經語音旁白...');
      let text = '我是 Sunny，端上一杯溫熱的茶。好好說話……為什麼這麼難？因為我們的心裡，總想證明自己贏。開口前，請給自己留白三秒：第一秒，鬆開咬緊的牙關，讓肩膀沉下去；第二秒問問自己：我現在是想爭輸贏，還是想解決問題？第三秒，點亮好奇：看著對方的眼睛，去聽聽他的世界，正在經歷什麼。所有真實的人生，皆在相遇之中。搜尋《心茶記》，找回對話的初心。';
      if (fs.existsSync(scriptPath)) {
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        const m = scriptContent.match(/【二、\s*旁白純文字.*?】\r?\n([\s\S]*?)(?:\r?\n【三、|$)/);
        if (m && m[1]) {
          const cleaned = m[1]
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('=') && !line.startsWith('-'))
            .join('');
          if (cleaned) {
            text = cleaned;
          }
        }
      }
      synthesizeVoice(text, voicePath);
    }
  }

  const vttPath = voicePath.replace(/\.[^.]+$/, '.vtt');

  // 2. Generate subtitles if not exists
  if (!fs.existsSync(assPath)) {
    console.log('📝 正在生成動態字幕與排版...');
    createAssSubtitles(assPath, vttPath);
  }

  // 3. Render video (Full-Screen 9:16 Vertical Immersive Visuals with Bottom Captions)
  console.log(`🎬 正在使用 FFmpeg 渲染 9:16 高清短影音（參考片風格：滿版直屏沉浸視角 + 底部清晰大字幕）...`);
  const coverFileName = path.basename(coverPath);
  const voiceFileName = path.basename(voicePath);
  const assFileName = path.basename(assPath);
  const outVideoFileName = path.basename(outVideo);

  // Check for multi-scene video clips or images
  const sceneFiles = fs.readdirSync(folder)
    .filter(f => /^scene[_-]?\d+\.(mp4|mov|mkv|jpg|jpeg|png)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  let cmd = '';
  if (sceneFiles.length > 1) {
    console.log(`🎞️ 偵測到 ${sceneFiles.length} 個分鏡素材，執行多場景混剪拼接...`);
    // Determine audio duration
    let dur = 55.0;
    try {
      const probeOut = execSync(`"${ffmpeg}" -i "${voiceFileName}" 2>&1`, { cwd: folder }).toString();
      const m = probeOut.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) {
        dur = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
      }
    } catch(e) {}

    const perScene = (dur / sceneFiles.length);
    let inputArgs = '';
    let filterPipes = '';
    let concatInputs = '';

    sceneFiles.forEach((file, idx) => {
      const isLast = idx === sceneFiles.length - 1;
      const sDur = isLast ? (dur - perScene * (sceneFiles.length - 1) + 1.0) : perScene;
      inputArgs += `-loop 1 -t ${sDur.toFixed(2)} -i "${file}" `;
      filterPipes += `[${idx}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v${idx}];`;
      concatInputs += `[v${idx}]`;
    });

    const filterComplex = `${filterPipes}${concatInputs}concat=n=${sceneFiles.length}:v=1:a=0,eq=contrast=1.04:brightness=0.01,subtitles=${assFileName}[v]`;
    cmd = `"${ffmpeg}" -y ${inputArgs}-i "${voiceFileName}" -filter_complex "${filterComplex}" -map "[v]" -map ${sceneFiles.length}:a -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${outVideoFileName}"`;
  } else {
    // Single image fallback
    cmd = `"${ffmpeg}" -y -loop 1 -framerate 30 -i "${coverFileName}" -i "${voiceFileName}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,eq=contrast=1.04:brightness=0.01[bg];[bg]subtitles=${assFileName}[v]" -map "[v]" -map 1:a -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${outVideoFileName}"`;
  }

  execSync(cmd, { cwd: folder, stdio: 'inherit' });

  if (fs.existsSync(outVideo)) {
    const stat = fs.statSync(outVideo);
    console.log(`\n🎉 影片成功生成！`);
    console.log(`📁 輸出檔案: ${outVideo}`);
    console.log(`📊 規格: 1080x1920 (9:16 直式) | 檔案大小: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    return outVideo;
  } else {
    throw new Error('影片生成失敗，輸出檔案不存在');
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const target = args[0] || 'd:/blog/social_posts/2026-10-24_溝通因子整合篇';
  try {
    renderShortVideo(target);
  } catch (err) {
    console.error('❌ 渲染失敗:', err.message);
    process.exit(1);
  }
}

module.exports = {
  renderShortVideo
};
