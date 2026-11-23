const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const postsDir = path.join(repoRoot, '_posts');

// 1. Strip UTF-8 BOM from all posts
console.log('--- Step 1: Strip UTF-8 BOM ---');
const postFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
let bomCount = 0;
for (const file of postFiles) {
  const filePath = path.join(postsDir, file);
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(filePath, buf.slice(3));
    console.log(`Stripped BOM: ${file}`);
    bomCount++;
  }
}
console.log(`Total BOM stripped: ${bomCount}`);

// 2. Convert <div class="coaching-box"> and <div style="..."> to Markdown quote blocks
console.log('--- Step 2: Convert harmful HTML tags in posts ---');
let htmlFixCount = 0;
for (const file of postFiles) {
  const filePath = path.join(postsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Convert coaching-box with ol/li
  content = content.replace(/<div\b[^>]*class=["']coaching-box["'][^>]*>\s*<p><strong>(.*?)<\/strong><\/p>\s*<ol>([\s\S]*?)<\/ol>\s*<\/div>/gi, (match, title, listContent) => {
    let items = [];
    const itemMatches = listContent.match(/<li>([\s\S]*?)<\/li>/gi) || [];
    itemMatches.forEach((li, idx) => {
      const text = li.replace(/<\/?li>/gi, '').trim();
      items.push(`> ${idx + 1}. ${text}`);
    });
    return `> ${title}\n>\n${items.join('\n')}`;
  });

  // Convert inline style coaching box (e.g. 2026-11-15)
  content = content.replace(/<div\b[^>]*style=["'][^"']*["'][^>]*>\s*<p[^>]*><strong>(.*?)<\/strong><\/p>\s*<ul[^>]*>([\s\S]*?)<\/ul>\s*<\/div>/gi, (match, title, listContent) => {
    let items = [];
    const itemMatches = listContent.match(/<li>([\s\S]*?)<\/li>/gi) || [];
    itemMatches.forEach((li, idx) => {
      const text = li.replace(/<\/?li>/gi, '').trim();
      items.push(`> ${idx + 1}. ${text}`);
    });
    return `> ${title}\n>\n${items.join('\n')}`;
  });

  // Also handle English coaching box
  content = content.replace(/<div\b[^>]*style=["'][^"']*["'][^>]*>\s*<p[^>]*><strong>(.*?)<\/strong><\/p>\s*<ol[^>]*>([\s\S]*?)<\/ol>\s*<\/div>/gi, (match, title, listContent) => {
    let items = [];
    const itemMatches = listContent.match(/<li>([\s\S]*?)<\/li>/gi) || [];
    itemMatches.forEach((li, idx) => {
      const text = li.replace(/<\/?li>/gi, '').trim();
      items.push(`> ${idx + 1}. ${text}`);
    });
    return `> ${title}\n>\n${items.join('\n')}`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Converted HTML coaching box to Markdown blockquote: ${file}`);
    htmlFixCount++;
  }
}
console.log(`Total HTML fixes: ${htmlFixCount}`);

// 3. Convert Mermaid blocks in the 14 post files to standard 茶禪思維對比卡
console.log('--- Step 3: Convert Mermaid blocks in posts ---');

const mermaidReplacements = {
  // 1. 2026-11-15-stop-gap-thinking-self-acknowledgement.md
  '2026-11-15-stop-gap-thinking-self-acknowledgement.md': [
    {
      target: /```mermaid[\s\S]*?flowchart LR[\s\S]*?第一步：中断运转[\s\S]*?```/,
      replacement: `> 🌲 **心智框架推演：自我认可 4 步心法**
>
> ・**第一步：中断运转**（物理阻断，照顾当下的情绪）  
> ・**第二步：抽离身份**（解离观察，把自己当成墙上的挂钟）  
> ・**第三步：放下标准**（识别并松开 Gap，允许今日的不完美）  
> ・**第四步：聚焦增量**（聚焦 The Gain，今天的我 vs 昨天的我）`
    }
  ],
  '2026-11-15-stop-gap-thinking-self-acknowledgement-en.md': [
    {
      target: /```mermaid[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: 4 Steps of Self-Acknowledgement**
>
> ・**Step 1: Pause and Reset** (Take care of your feelings first)  
> ・**Step 2: Step Back** (Look at yourself like a quiet clock on the wall)  
> ・**Step 3: Drop Perfect Standards** (Let go of the Gap, allow imperfection)  
> ・**Step 4: Focus on the Gain** (Compare today with yesterday, celebrate small steps)`
    }
  ],

  // 2. 2026-11-16-verbal-aikido-reframing.md
  '2026-11-16-verbal-aikido-reframing.md': [
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?对方抛出绝对否定[\s\S]*?```/,
      replacement: `> 🌲 **心智框架对比：面对刺耳否定时的 3 种应对惯性**
>
> ❌ **本能反击（拔刀对撞 · 两败俱伤）**
> ・应对方式：“你懂什么？你行你来啊！”
> ・实际结果：触发对方二次防御，演变成权力拔河与情绪肉搏。
>
> ❌ **本能退缩（自我攻击 · 陷入内耗）**
> ・应对方式：“好吧，可能真的是我太笨了……”
> ・实际结果：陷入自我否定与委屈，彻底交出话语权与自信。
>
> 💡 **语言合气道（借力打力 · 邀请同盟）**
> ・应对方式：① 卸力承认困难 $\\rightarrow$ ② 降级人身攻击 $\\rightarrow$ ③ 邀请对方出谋划策。
> ・实际结果：把冷酷的审判者拉上车，转化为共同破局的军师。`
    },
    {
      target: /```mermaid[\s\S]*?flowchart LR[\s\S]*?第一步：卸下阻力[\s\S]*?```/,
      replacement: `> 🌲 **步骤推演：语言合气道 3 步转化**
>
> ・**第一步：卸下阻力**（“你说得没错，这确实不容易”）  
> ・**第二步：概念降级**（将“不可能”降为“有挑战”，将“愚蠢”降为“尚不够周全”）  
> ・**第三步：角色转化**（“除非具备哪些条件？若是你，会如何做比较有效？”）`
    }
  ],
  '2026-11-16-verbal-aikido-reframing-en.md': [
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: 3 Ways to Handle Harsh Criticism**
>
> ❌ **Fight Back (Anger & Clashing)**
> ・Reaction: "What do you know? If you're so smart, you do it!"
> ・Result: Causes a power struggle and emotional fight.
>
> ❌ **Shrink Back (Self-Blame & Retreat)**
> ・Reaction: "Maybe I really am just stupid..."
> ・Result: Gives away your power and confidence.
>
> 💡 **Verbal Aikido (Using Their Energy to Step Forward)**
> ・Reaction: ① Accept the difficulty $\\rightarrow$ ② Lower the extreme words $\\rightarrow$ ③ Invite them to help solve it.
> ・Result: Turns a harsh critic into a teammate working with you.`
    },
    {
      target: /```mermaid[\s\S]*?flowchart LR[\s\S]*?```/,
      replacement: `> 🌲 **Action Steps: The 3 Steps of Verbal Aikido**
>
> ・**Step 1: Release Resistance** ("You're right, this is tricky")  
> ・**Step 2: Soften Harsh Words** (Turn "impossible" into "challenging", turn "stupid" into "needs more thought")  
> ・**Step 3: Invite Them in** ("What would make it work? If you were in my shoes, what would you try?")`
    }
  ],

  // 3. 2026-11-18-action-transforms-fear-into-wisdom.md
  '2026-11-18-action-transforms-fear-into-wisdom.md': [
    {
      target: /```mermaid[\s\S]*?flowchart LR[\s\S]*?悬浮的未知恐惧[\s\S]*?```/,
      replacement: `> 🌲 **心智框架对比：面对未知恐惧的两条路径**
>
> ❌ **悬浮等待（脑力空转 · 内耗加剧）**
> ・心智焦点：大脑静态脑补最坏灾难，恐惧滞留原地。
> ・实际结果：引发持续的内部摩擦，精力在犹豫中枯竭。
>
> 💡 **极小微步（能量导流 · 转化智慧）**
> ・心智焦点：像避雷针一样，透过具体微小的行动将恐惧落地。
> ・实际结果：采集真实体感反馈，恐惧在接触现实时消融为智慧。`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?具体的行动[\s\S]*?```/,
      replacement: `> 🌲 **推演闭环：恐惧转化智慧的 4 步循环（Kolb 学习圈）**
>
> 1. **具体行动 (Concrete Action)**：踏出毫无心理负担的微步。  
> 2. **真实体感 (Concrete Experience)**：在现实中采集客观的身体与情境反馈。  
> 3. **觉察反思 (Reflective Observation)**：拉开距离，冷静看清“最坏的事并没有发生”。  
> 4. **提炼智慧 (Abstract Conceptualization)**：凝结为未来的信心锚点，驱动下一次行动。`
    }
  ],
  '2026-11-18-action-transforms-fear-into-wisdom-en.md': [
    {
      target: /```mermaid[\s\S]*?flowchart LR[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: Two Paths When Facing Fear**
>
> ❌ **Waiting and Overthinking (Inner Exhaustion)**
> ・Focus: Brain pictures the worst disaster while sitting still.
> ・Result: High friction, zero movement, draining your energy.
>
> 💡 **Tiny Action Steps (Grounding Your Energy)**
> ・Focus: Acts like a lightning rod, grounding anxiety into reality.
> ・Result: Collects real physical feedback, melting fear into wisdom.`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?```/,
      replacement: `> 🌲 **Action Loop: Turning Fear into Wisdom in 4 Steps**
>
> 1. **Concrete Action**: Take one tiny step with zero pressure.  
> 2. **Real Experience**: Feel what actually happens in reality.  
> 3. **Quiet Reflection**: Step back and see: "The worst scenario didn't happen."  
> 4. **Inner Wisdom**: Turn the experience into real confidence for next time.`
    }
  ],

  // 4. 2026-11-18-self-management-energy-two-wolves.md
  '2026-11-18-self-management-energy-two-wolves.md': [
    {
      target: /```mermaid[\s\S]*?flowchart LR[\s\S]*?第一步：抓包[\s\S]*?```/,
      replacement: `> 🌲 **步骤推演：能量自我管理 3 步心法**
>
> ・**第一步：抓包 (Catch)**（敏锐觉察恐惧之狼正在索要负面反刍的食物）  
> ・**第二步：断食 (Starve)**（温柔切断对受害者思维与自责剧本的注意力喂养）  
> ・**第三步：投喂 (Feed)**（透过踏实微步行动，赋能内在智慧之狼的正向意图）`
    }
  ],
  '2026-11-18-self-management-energy-two-wolves-en.md': [
    {
      target: /```mermaid[\s\S]*?```/,
      replacement: `> 🌲 **Steps: 3 Steps of Inner Energy Management**
>
> ・**Step 1: Catch** (Notice when the fearful wolf is asking for negative thoughts)  
> ・**Step 2: Starve** (Gently stop feeding it worry, blame, and victim stories)  
> ・**Step 3: Feed** (Take a small, positive action to feed the wise wolf inside)`
    }
  ],

  // 5. 2026-11-20-beyond-toxic-independence-interpersonal-resource-framework.md
  '2026-11-20-beyond-toxic-independence-interpersonal-resource-framework.md': [
    {
      target: /```mermaid[\s\S]*?```/,
      replacement: `> 🌲 **心智框架：人际资源支持的 4 大维度**
>
> ・**维度 1：情感与心灵支持**（接住情绪 · 深度觉察）$\\rightarrow$ 包含专业教练、挚友、心理咨询师  
> ・**维度 2：专业与决策支持**（专业排雷 · 减少试错）$\\rightarrow$ 包含行业导师、律师、财务顾问  
> ・**维度 3：协作与互补支持**（分工落地 · 优势互补）$\\rightarrow$ 包含团队伙伴、业务协作者、助理  
> ・**维度 4：习惯与同行支持**（互相督促 · 正向场域）$\\rightarrow$ 包含共读战友、健身伙伴、研习同侪`
    }
  ],
  '2026-11-20-beyond-toxic-independence-interpersonal-resource-framework-en.md': [
    {
      target: /```mermaid[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: 4 Kinds of People Support**
>
> ・**1. Emotional Support** (Listening & feeling understood) $\\rightarrow$ Coaches, close friends, counselors  
> ・**2. Expert Advice** (Making good choices & avoiding pitfalls) $\\rightarrow$ Mentors, lawyers, advisors  
> ・**3. Teamwork Support** (Sharing tasks & strengths) $\\rightarrow$ Teammates, assistants, partners  
> ・**4. Habit Support** (Growing together in a good environment) $\\rightarrow$ Study buddies, workout partners`
    }
  ],

  // 6. 2026-11-20-commitment-to-change-navigating-barriers-part-1.md
  '2026-11-20-commitment-to-change-navigating-barriers-part-1.md': [
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?面对渴望的改变[\s\S]*?```/,
      replacement: `> 🌲 **心智框架对比：启航心态的两种路径**
>
> ❌ **“试一试”心态（防御退路 · 原地打转）**
> ・承诺状态：承诺度低下（3~5 分），注意力始终在找如何体面撤退的借口。
> ・遭遇阻力：微小挫折降临便立刻放大无力感，半途而废，陷入恶性内耗。
>
> 💡 **“拥有权”心态（愿景拉动 · 破局本能）**
> ・承诺状态：100% 内在承诺，清晰看见改变后的自我与美好愿景。
> ・遭遇阻力：提前预视暗礁，备妥安全气囊，自我效能感越滚越大。`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?1\. 预视潜在暗礁[\s\S]*?```/,
      replacement: `> 🌲 **步骤推演：穿越改变暗礁的 4 步演练**
>
> 1. **预视潜在暗礁**：提前识别最容易打乱计划的具体诱惑或疲惫情境。  
> 2. **设计“如果…那么…”公式**：提前固化应对暗礁的自动化微习惯。  
> 3. **盘点人际与物理资源**：备妥外部伙伴与环境支持的安全气囊。  
> 4. **从容穿越风浪**：放下自责，把阻碍降级为日常路况，清醒掌舵前行。`
    }
  ],
  '2026-11-20-commitment-to-change-navigating-barriers-part-1-en.md': [
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?Facing a Desired Change[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: Two Mindsets When Starting Change**
>
> ❌ **"Just Try It" Mindset (Looking for Exit Doors)**
> ・Commitment: Low (3-5/10), looking for safe excuses to quit.
> ・When hurdles hit: Small hiccups feel huge, leading to giving up.
>
> 💡 **"Ownership" Mindset (Driven by Clear Vision)**
> ・Commitment: 100% inside, clearly seeing the better tomorrow.
> ・When hurdles hit: Anticipates obstacles, prepares backup cushions.`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?```/,
      replacement: `> 🌲 **Action Steps: 4 Steps to Navigate Hurdles**
>
> 1. **Spot Hidden Reefs**: Identify what usually throws you off track.  
> 2. **Use "If-Then" Plans**: Automate your response before stress hits.  
> 3. **Build Safety Airbags**: Gather people and quiet spaces to support you.  
> 4. **Sail Through Smoothly**: Treat bumps as normal road conditions, not failure.`
    }
  ],

  // 7. 2026-11-21-commitment-to-change-fuel-and-maintenance-part-2.md
  '2026-11-21-commitment-to-change-fuel-and-maintenance-part-2.md': [
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?落差思维[\s\S]*?```/,
      replacement: `> 🌲 **心智框架对比：改变进程的两种评估视角**
>
> ❌ **落差思维（The Gap · 心理燃料枯竭）**
> ・思维焦点：拿今天笨拙的自己对比遥远、完美的终点线。
> ・情绪结果：放大未完成的挫败与自责，动力被焦虑侵蚀殆尽。
>
> 💡 **增量思维（The Gain · 踏实自信蓄水池）**
> ・思维焦点：拿今天的自己对比过去未曾觉察、未曾起步的状态。
> ・情绪结果：看见点滴积累的进步，持续为神经回路注入向前的成就感。`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?日常琐事与通知碎片环伺[\s\S]*?```/,
      replacement: `> 🌲 **心智框架对比：面对注意力干扰的两种选择**
>
> ❌ **苦行僧式强行压抑**：单靠意志力硬抗通知与干扰，精神迅速耗竭并剧烈反弹。  
> 💡 **重连深层愿景渴望**：开辟每日 10 分钟“愿景专注岛”，在生活夹缝中从容积累。`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?现实环境改变[\s\S]*?```/,
      replacement: `> 🌲 **心智框架对比：面对环境剧变时的目标调整**
>
> ❌ **死守僵化木靶**：无视体能或生活突变硬撑到底，身心过度透支并陷入自责。  
> 💡 **动态校准靶心**：诚实接纳当下身心负荷，动态重设踏实微步，保护内在小信心。`
    }
  ],
  '2026-11-21-commitment-to-change-fuel-and-maintenance-part-2-en.md': [
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: Two Ways to Look at Progress**
>
> ❌ **The Gap Mindset (Running Out of Energy)**
> ・Focus: Comparing today's messy effort against an impossible perfect goal.
> ・Result: Feeling behind, anxious, and beating yourself up.
>
> 💡 **The Gain Mindset (Building Real Confidence)**
> ・Focus: Comparing today with where you started before you made this choice.
> ・Result: Real pride in small steps, giving your mind steady fuel.`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: Two Ways to Handle Distractions**
>
> ❌ **Pure Willpower Battle**: Trying to force yourself to ignore all pings, ending in burnout.  
> 💡 **Reconnecting with Vision**: Creating a 10-minute quiet island each day to grow steadily.`
    },
    {
      target: /```mermaid[\s\S]*?flowchart TD[\s\S]*?```/,
      replacement: `> 🌲 **Mental Framework: Adjusting When Life Changes**
>
> ❌ **Rigid Targets**: Forcing yourself through illness or chaos, feeling like a failure.  
> 💡 **Flexible Targets**: Honestly adjusting your daily steps to protect your confidence.`
    }
  ]
};

let mermaidCount = 0;
for (const [file, list] of Object.entries(mermaidReplacements)) {
  const filePath = path.join(postsDir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  for (const item of list) {
    content = content.replace(item.target, item.replacement);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Converted Mermaid to Markdown quote cards: ${file}`);
    mermaidCount++;
  }
}
console.log(`Total Mermaid files converted: ${mermaidCount}`);

// 4. Update prohibited domain check in daily_qa_audit.js
console.log('--- Step 4: Refine daily_qa_audit.js prohibited domains regex ---');
const auditScriptPath = path.join(repoRoot, 'scripts', 'daily_qa_audit.js');
let auditContent = fs.readFileSync(auditScriptPath, 'utf8');

// Update prohibited domain check logic:
// Must NOT match 'blog.portal-coachsunny.com'
const oldDomainCheck = `    // Check Prohibited Domains
    for (const domain of PROHIBITED_DOMAINS) {
      if (content.includes(domain)) {
        addIssue('P0', file, \`包含已被廢止或錯誤的網域: \${domain}\`, '替換為官方正式網域 https://blog.portal-coachsunny.com/');
      }
    }`;

const newDomainCheck = `    // Check Prohibited Domains (Exact negative lookbehind to avoid portal-coachsunny.com)
    const prohibitedRegexes = [
      { name: 'coachsunny.com', regex: /(?:https?:\\/\\/)?(?<!portal-)(?:www\\.)?coachsunny\\.com(?![a-zA-Z0-9\\.\\-])/i },
      { name: 'sunnycoach.com', regex: /(?:https?:\\/\\/)?(?:www\\.)?sunnycoach\\.com(?![a-zA-Z0-9\\.\\-])/i },
      { name: 'sunnycoach.github.io', regex: /(?:https?:\\/\\/)?sunnycoach\\.github\\.io/i },
      { name: 'coachsunny.github.io', regex: /(?:https?:\\/\\/)?coachsunny\\.github\\.io/i }
    ];
    for (const p of prohibitedRegexes) {
      if (p.regex.test(content)) {
        addIssue('P0', file, \`包含已被廢止或錯誤的網域: \${p.name}\`, '替換為官方正式網域 https://blog.portal-coachsunny.com/');
      }
    }`;

if (auditContent.includes('const PROHIBITED_DOMAINS = [')) {
  auditContent = auditContent.replace(oldDomainCheck, newDomainCheck);
  fs.writeFileSync(auditScriptPath, auditContent, 'utf8');
  console.log('Refined domain check in scripts/daily_qa_audit.js');
}

console.log('--- Finished P0 Fixes ---');
