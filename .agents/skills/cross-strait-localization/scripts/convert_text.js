const fs = require('fs');
const path = require('path');

const refDir = path.join(__dirname, '../references');

// Load dictionaries
let stChars = {};
let stPhrases = {};
let twPhrases = {};
let customMapping = { sc_to_tc_terms: {}, tc_to_sc_terms: {} };

try {
  stChars = JSON.parse(fs.readFileSync(path.join(refDir, 'st_characters.json'), 'utf8'));
  stPhrases = JSON.parse(fs.readFileSync(path.join(refDir, 'st_phrases.json'), 'utf8'));
  twPhrases = JSON.parse(fs.readFileSync(path.join(refDir, 'tw_phrases.json'), 'utf8'));
  customMapping = JSON.parse(fs.readFileSync(path.join(refDir, 'vocabulary_mapping.json'), 'utf8'));
} catch (e) {
  console.warn('⚠️ Warning: failed to load one or more dictionary files in convert_text.js', e.message);
}

// Build reverse character map (Traditional -> Simplified)
const tsChars = {};
for (const [sChar, tChar] of Object.entries(stChars)) {
  if (tChar && !tsChars[tChar]) {
    tsChars[tChar] = sChar;
  }
}

// Build phrase replacement regexes sorted by length descending
function buildPhraseReplacer(phraseMap) {
  const sortedKeys = Object.keys(phraseMap).sort((a, b) => b.length - a.length);
  if (sortedKeys.length === 0) return (text) => text;
  
  // Chunk regex if too large, or use replace callback
  const pattern = new RegExp(sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return (text) => text.replace(pattern, (matched) => phraseMap[matched] || matched);
}

// Compile combined phrases for s2tw
const combinedS2TwPhrases = {
  ...stPhrases,
  ...twPhrases,
  ...customMapping.sc_to_tc_terms
};
const replaceS2TwPhrases = buildPhraseReplacer(combinedS2TwPhrases);

// Compile combined phrases for tw2s
const combinedTw2SPhrases = {
  ...customMapping.tc_to_sc_terms
};
const replaceTw2SPhrases = buildPhraseReplacer(combinedTw2SPhrases);

/**
 * Convert Simplified Chinese to Taiwan Traditional Chinese (zh-TW)
 */
function s2tw(text) {
  if (!text) return '';

  // 1. Phrase replacement (domain terms + Taiwan vocabulary + multi-char phrases)
  let out = replaceS2TwPhrases(text);

  // 2. Character-by-character replacement
  let charArray = Array.from(out);
  for (let i = 0; i < charArray.length; i++) {
    const ch = charArray[i];
    if (stChars[ch]) {
      charArray[i] = stChars[ch];
    }
  }
  out = charArray.join('');

  // 3. Punctuation conversion (Mainland quotes to Taiwan quotes)
  out = out
    .replace(/“/g, '「')
    .replace(/”/g, '」')
    .replace(/‘/g, '『')
    .replace(/’/g, '』');

  return out;
}

/**
 * Convert Taiwan Traditional Chinese to Mainland Simplified Chinese (zh-CN)
 */
function tw2s(text) {
  if (!text) return '';

  // 1. Phrase replacement (Taiwan terms to Mainland terms)
  let out = replaceTw2SPhrases(text);

  // 2. Character-by-character replacement
  let charArray = Array.from(out);
  for (let i = 0; i < charArray.length; i++) {
    const ch = charArray[i];
    if (tsChars[ch]) {
      charArray[i] = tsChars[ch];
    }
  }
  out = charArray.join('');

  // 3. Punctuation conversion (Taiwan quotes to Mainland quotes)
  out = out
    .replace(/「/g, '“')
    .replace(/」/g, '”')
    .replace(/『/g, '‘')
    .replace(/』/g, '’');

  return out;
}

// CLI Support
if (require.main === module) {
  const args = process.argv.slice(2);
  let mode = 's2tw';
  let inputPath = null;
  let outputPath = null;
  let inlineText = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      mode = args[++i];
    } else if (args[i] === '--input' && args[i + 1]) {
      inputPath = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[++i];
    } else if (args[i] === '--text' && args[i + 1]) {
      inlineText = args[++i];
    }
  }

  const converter = mode === 'tw2s' ? tw2s : s2tw;

  if (inlineText) {
    console.log(converter(inlineText));
  } else if (inputPath) {
    const content = fs.readFileSync(inputPath, 'utf8');
    const converted = converter(content);
    if (outputPath) {
      fs.writeFileSync(outputPath, converted, 'utf8');
      console.log(`✅ 已成功轉換至: ${outputPath}`);
    } else {
      console.log(converted);
    }
  } else {
    console.log('Usage: node convert_text.js [--mode s2tw|tw2s] [--input file] [--output file] [--text "content"]');
  }
}

module.exports = {
  s2tw,
  tw2s
};
