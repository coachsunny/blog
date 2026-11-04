import sys
import asyncio
import os
import time
import edge_tts

# Ensure stdout and stderr support UTF-8 on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

async def synthesize(text_path, out_media, out_sub):
    with open(text_path, 'r', encoding='utf-8') as f:
        text = f.read().strip()

    voice = 'zh-TW-YunJheNeural'
    rate = '-15%'
    pitch = '-5Hz'

    for attempt in range(3):
        try:
            print(f"[TTS] Synthesizing with {voice} (Attempt {attempt + 1}/3)...")
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            submaker = edge_tts.SubMaker()

            with open(out_media, "wb") as audio_file:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_file.write(chunk["data"])
                    elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                        submaker.feed(chunk)

            with open(out_sub, "w", encoding="utf-8") as sub_file:
                sub_file.write(submaker.get_srt())

            if os.path.exists(out_media) and os.path.getsize(out_media) > 1000:
                print(f"[TTS] Success! Size: {os.path.getsize(out_media)} bytes")
                return True
        except Exception as e:
            print(f"[TTS] Warning: {e}, retrying in 2s...")
            await asyncio.sleep(2)

    raise RuntimeError("TTS failed after 3 attempts")

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python synthesize_voice.py <text_path> <out_media> <out_sub>")
        sys.exit(1)

    text_file = sys.argv[1]
    out_media = sys.argv[2]
    out_sub = sys.argv[3]

    asyncio.run(synthesize(text_file, out_media, out_sub))
