const fs = require('fs');
const path = require('path');

function findRepoRoot(startDir) {
  let cur = startDir;
  while (cur && path.dirname(cur) !== cur) {
    if (fs.existsSync(path.join(cur, '_posts')) || fs.existsSync(path.join(cur, '.git'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return path.resolve(startDir, '../../../..');
}

function archiveCover(sourceImagePath, postSlug, targetSocialDirName) {
  const repoRoot = findRepoRoot(__dirname);

  if (!fs.existsSync(sourceImagePath)) {
    throw new Error(`來源圖片不存在: ${sourceImagePath}`);
  }

  const stat = fs.statSync(sourceImagePath);
  if (stat.size === 0) {
    throw new Error(`來源圖片為 0 位元組空檔: ${sourceImagePath}`);
  }

  // Target 1: social_posts/YYYY-MM-DD_主題名/cover.jpg
  const socialPostDir = path.join(repoRoot, 'social_posts', targetSocialDirName);
  if (!fs.existsSync(socialPostDir)) {
    fs.mkdirSync(socialPostDir, { recursive: true });
  }
  const dest1 = path.join(socialPostDir, 'cover.jpg');

  // Target 2: social_assets/<slug>.jpg
  const socialAssetsDir = path.join(repoRoot, 'social_assets');
  if (!fs.existsSync(socialAssetsDir)) {
    fs.mkdirSync(socialAssetsDir, { recursive: true });
  }
  const dest2 = path.join(socialAssetsDir, `${postSlug}.jpg`);

  // Copy files
  fs.copyFileSync(sourceImagePath, dest1);
  fs.copyFileSync(sourceImagePath, dest2);

  const size1 = fs.statSync(dest1).size;
  const size2 = fs.statSync(dest2).size;

  console.log(`✅ 封面圖檔已成功同步歸檔:`);
  console.log(`   1. 社群分發包: ${dest1} (${(size1 / 1024).toFixed(1)} KB)`);
  console.log(`   2. 專欄永久資產: ${dest2} (${(size2 / 1024).toFixed(1)} KB)`);

  return { dest1, dest2 };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: node archive_cover.js <sourceImagePath> <postSlug> <targetSocialDirName>');
    console.log('Example: node archive_cover.js /path/to/img.jpg physical-environment-and-communication-medium 2026-10-18_物理環境與溝通媒介');
    process.exit(1);
  }

  try {
    archiveCover(args[0], args[1], args[2]);
  } catch (err) {
    console.error('❌ 歸檔失敗:', err.message);
    process.exit(1);
  }
}

module.exports = {
  archiveCover
};
