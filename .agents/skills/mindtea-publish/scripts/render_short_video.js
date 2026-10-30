const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

/**
 * Synthesize voiceover using Windows Speech Synthesis
 */
function synthesizeVoice(text, outWavPath) {
  const psCode = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$installed = $synth.GetInstalledVoices()
$voice = $installed | Where-Object { $_.VoiceInfo.Name -like "*Hanhan*" -or $_.VoiceInfo.Culture.Name -eq "zh-TW" } | Select-Object -First 1
if ($voice) {
    $synth.SelectVoice($voice.VoiceInfo.Name)
}
$synth.Rate = 0
$synth.SetOutputToWaveFile('${outWavPath.replace(/\\/g, '\\\\')}')
$synth.Speak('${text.replace(/'/g, "''")}')
$synth.Dispose()
`;
  const b64 = Buffer.from(psCode, 'utf16le').toString('base64');
  execSync(`powershell -EncodedCommand ${b64}`, { stdio: 'ignore' });
}

/**
 * Generate .ass subtitle file
 */
function createAssSubtitles(assPath, linesData) {
  const assContent = `[Script Info]
Title: Mind Tea Journal Short Video
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft JhengHei,56,&H00FFFFFF,&H000000FF,&H00182C1F,&H80000000,-1,0,0,0,100,100,2,0,1,3.5,2,2,40,40,360,1
Style: TitleCard,Microsoft JhengHei,68,&H00E6F0E8,&H000000FF,&H0024442F,&H90000000,-1,0,0,0,100,100,4,0,1,4,3,8,40,40,320,1
Style: Watermark,Microsoft JhengHei,38,&H00D0DDD3,&H000000FF,&H001C3524,&H00000000,0,0,0,0,100,100,2,0,1,2,1,8,40,40,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:34.00,Watermark,,0,0,0,,🍵 心茶記 · 晨光微光 ｜ 30秒心智沈澱
Dialogue: 0,0:00:00.00,0:00:04.50,TitleCard,,0,0,0,,好好說一句話，為什麼這麼難？
Dialogue: 0,0:00:00.00,0:00:04.50,Default,,0,0,0,,因為我們總想證明自己「贏」
Dialogue: 0,0:00:04.50,0:00:14.00,TitleCard,,0,0,0,,【開口前的三秒留白】
Dialogue: 0,0:00:04.50,0:00:09.00,Default,,0,0,0,,第一秒，鬆開咬緊的牙關
Dialogue: 0,0:00:09.00,0:00:14.00,Default,,0,0,0,,第二秒問自己：我是想爭輸贏，還是想解決問題？
Dialogue: 0,0:00:14.00,0:00:23.50,TitleCard,,0,0,0,,【第三秒：點亮好奇】
Dialogue: 0,0:00:14.00,0:00:23.50,Default,,0,0,0,,看著對方的眼睛，去聽聽他的世界正在經歷什麼
Dialogue: 0,0:00:23.50,0:00:34.00,TitleCard,,0,0,0,,所有真實的人生，皆在相遇之中
Dialogue: 0,0:00:23.50,0:00:34.00,Default,,0,0,0,,搜尋《心茶記》，找回對話的初心
`;
  fs.writeFileSync(assPath, assContent, 'utf8');
}

/**
 * Render complete 9:16 vertical short video
 */
function renderShortVideo(targetFolder) {
  const ffmpeg = findFFmpeg();
  const folder = path.resolve(targetFolder);

  const coverPath = path.join(folder, 'cover.jpg').replace(/\\/g, '/');
  const voicePath = path.join(folder, 'voiceover.wav').replace(/\\/g, '/');
  const assPath = path.join(folder, 'subtitles.ass').replace(/\\/g, '/');
  const outVideo = path.join(folder, 'short_video.mp4').replace(/\\/g, '/');
  const scriptPath = path.join(folder, '08_短視頻腳本.txt');

  if (!fs.existsSync(coverPath)) {
    throw new Error(`找不到封面圖片: ${coverPath}`);
  }

  // 1. Synthesize voice if not exists
  if (!fs.existsSync(voicePath)) {
    console.log('🎤 正在生成 AI 語音旁白...');
    let text = '好好說話為什麼這麼難？因為我們總想證明自己「贏」。開口前，請留白三秒：第一秒，鬆開咬緊的牙關；第二秒問自己：我是想爭輸贏，還是想解決問題？第三秒點亮好奇：看著對方的眼睛，去聽聽他的世界，正在經歷什麼。所有真實的人生，皆在相遇之中。搜尋《心茶記》，找回對話的初心。';
    if (fs.existsSync(scriptPath)) {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      const m = scriptContent.match(/【二、 旁白純文字.*?】\r?\n([\s\S]*?)(?:\r?\n=|$)/);
      if (m && m[1].trim()) {
        text = m[1].trim();
      }
    }
    synthesizeVoice(text, voicePath);
  }

  // 2. Generate subtitles if not exists
  if (!fs.existsSync(assPath)) {
    console.log('📝 正在生成動態字幕與排版...');
    createAssSubtitles(assPath);
  }

  // 3. Render video
  console.log(`🎬 正在使用 FFmpeg 渲染 9:16 高清短影音...`);
  const assEscaped = assPath.replace(/\\/g, '/').replace(':', '\\:');
  const cmd = `"${ffmpeg}" -y -loop 1 -framerate 30 -i "${coverPath}" -i "${voicePath}" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5,eq=brightness=-0.12:contrast=1.05[bg];[0:v]scale=940:-1[fg];[bg][fg]overlay=(W-w)/2:320[base];[base]subtitles='${assEscaped}'[v]" -map "[v]" -map 1:a -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${outVideo}"`;

  execSync(cmd, { stdio: 'ignore' });

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
