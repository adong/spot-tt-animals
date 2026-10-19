/* Spot TT Animals in 中文: the game's own words for Kit.lang (kit/lang.js). Loaded last, after js/keys.js.
   Page text translates by itself from this dictionary; text with numbers or names uses the rules below. */
(function () {
  'use strict';
  const L = Kit.lang;
  const AN = { CHICKENS: '小鸡', COWS: '奶牛', SHEEP: '绵羊', ROOSTERS: '公鸡', HENS: '母鸡' };
  const MW = { COWS: '头', SHEEP: '只', CHICKENS: '只', ROOSTERS: '只', HENS: '只' }; // measure words
  const WHO = { YOU: '你', 'THE COMPUTER': '电脑', COMPUTER: '电脑', 'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2' };
  const SKY = { '☀️ DAY': '☀️ 白天', '🌙 NIGHT': '🌙 夜晚' };
  const DIFF = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };

  L.keep(['Backspace', 'Esc', 'TEDDY', 'TOMMY', 'ZOOM', 'TEDDY & TOMMY', 'SPOT', 'ANIMALS', 'SPOT TT ANIMALS', 'Spot TT Animals', 'Claude Code', '1P', '2P', '???', '❓ ???']);
  L.add({
    // title and menus
    'Look through your binoculars and count the animals!': '用望远镜数一数动物！',
    '▶ PLAY GAME': '▶ 开始游戏', '🦸 CHARACTERS': '🦸 角色', '⚙️ SETTINGS': '⚙️ 设置',
    'Enter play · C characters · S settings · M sound': '回车 开始 · C 角色 · S 设置 · M 声音',
    'a game designed by Teddy': 'Teddy 设计的游戏', 'LOADING…': '加载中…',
    'GAME SETUP': '游戏设置', 'TWO PLAYERS': '双人', 'side by side · key 1': '两人并排 · 按 1',
    'VS COMPUTER': '对战电脑', 'you against the computer · key 2': '你和电脑比 · 按 2',
    '🟢 EASY': '🟢 简单', '🟡 MEDIUM': '🟡 中等', '🔴 HARD': '🔴 困难',
    '60 s to count': '数 60 秒', '30 s to count': '数 30 秒', '15 s to count': '数 15 秒',
    '☀️ DAY': '☀️ 白天', '🌙 NIGHT': '🌙 夜晚', '🌗 MIX': '🌗 混合', 'bright': '亮亮的', 'dark!': '黑黑的！', 'a bit of both': '都有一点',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2', 'YOU': '你', 'COMPUTER': '电脑', '🤖 CPU': '🤖 电脑',
    'START ▶': '开始 ▶', '◀ BACK': '◀ 返回',
    'Enter start · 1 two players · 2 vs computer · Esc back': '回车 开始 · 1 双人 · 2 对战电脑 · Esc 返回',
    'CHARACTERS': '角色', 'SETTINGS': '设置',
    'Sound': '声音', '🔊 ON': '🔊 开', '🔇 OFF': '🔇 关', 'When both answers are wrong': '两个人都答错的时候',
    'DRAW': '平局', 'for now': '暂时这样', 'CLOSEST WINS': '最接近的赢', 'an idea to try': '可以试试',
    'Characters': '角色', '🔓 UNLOCK ALL': '🔓 全部解锁', '↺ START OVER': '↺ 从头开始',
    '↻ NEW GAME': '↻ 新游戏', 'P · Esc · Space resume · R new game · Q menu · M sound': 'P · Esc · 空格 继续 · R 新游戏 · Q 菜单 · M 声音',
    'WINNER!': '赢家！', "IT'S A DRAW!": '平局！', 'THE COMPUTER WINS!': '电脑赢了！', '↻ PLAY AGAIN': '↻ 再玩一次',
    'Enter play again · Esc menu': '回车 再玩一次 · Esc 菜单', 'TOTAL': '总分',
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    // characters
    'WIDE VIEW': '大视野', 'FREEZE': '冻住', 'SPOTLIGHT': '探照灯',
    '🔭 WIDE VIEW': '🔭 大视野', '❄️ FREEZE': '❄️ 冻住', '🚁 SPOTLIGHT': '🚁 探照灯',
    'Bigger binoculars: he sees more of his field at once. Always on.': '更大的望远镜：一下子能看到更多田地。一直有效。',
    '🔒 locked': '🔒 还没解锁', 'Coming soon: Teddy is still inventing this power.': '敬请期待：Teddy 还在发明这个本领。',
    "Ideas Teddy hasn't decided yet": 'Teddy 还没决定的点子',
    // playing
    'TIME': '时间', 'GET READY': '准备', 'ANSWER!': '回答！', 'COUNT': '数完了', 'TIME LEFT': '还剩',
    '🔭 BIG BINOCULARS': '🔭 大望远镜', '· always on': '· 一直有效', 'lock': '锁定',
    'READY': '好了', 'ON!': '开着！', '🌙 NIGHT ONLY': '🌙 只能晚上用',
    '✓ LOCKED': '✓ 锁定了', 'the computer has answered': '电脑已经答了', 'the computer is thinking': '电脑在想',
    'hidden until both are in': '两个人都答完才揭晓', 'locked in!': '锁定了！', 'tap your number': '点你的数字',
    'type the number, or click it': '输入数字，或者点一下',
    'NO ANSWER': '没回答', 'Animals': '动物', 'Answer': '答案', 'Result': '结果',
    'NEXT ROUND ▶': '下一轮 ▶', 'FINAL SCORE ▶': '最终比分 ▶',
    '✅ Correct': '✅ 答对了', '❌ Incorrect': '❌ 答错了', '⏰ No answer': '⏰ 没回答',
    'YOU WIN THE ROUND!': '这一轮你赢了！', 'THE COMPUTER WINS THE ROUND!': '这一轮电脑赢了！',
    'BOTH RIGHT: A DRAW!': '都答对了：平局！', 'NOBODY GOT IT: A DRAW!': '都没答对：平局！',
    '❄️ FREEZE!': '❄️ 冻住！', '🚁 SPOTLIGHT!': '🚁 探照灯！', '🔭 ALWAYS ON!': '🔭 一直有效！', 'TYPE A NUMBER FIRST': '先输入一个数字',
    'FENCE': '栅栏', 'THERE WERE': '一共有', 'SAID': '答了',
    'Difficulty': '难度', 'Day or night': '白天还是夜晚', 'When both are wrong': '两个人都答错时',
    // answering early (Alan's request)
    '✋ READY': '✋ 数好了', '⏰ TOO SLOW!': '⏰ 太慢啦！', 'too slow this time!': '这次太慢啦！',
    'locked! the other player is still counting': '锁定了！对方还在数',
    // the keys (js/keys.js) and moving the binoculars
    'move your binoculars (or just use the mouse)': '移动望远镜（直接用鼠标也行）',
    'count +1 · −1 (your hidden clicker)': '计数 +1 · −1（藏起来的计数器）',
    'use your power ❄️ freeze · 🚁 spotlight': '用本领 ❄️ 冻住 · 🚁 探照灯',
    "I'm ready · lock your answer (you have 30 s)": '数好了 · 锁定答案（有 30 秒）',
    'E Q to fix your count · Space to lock': 'E Q 改数字 · 空格 锁定',
    '> < to fix your count · Enter to lock': '> < 改数字 · 回车 锁定',
    // your brother (the companion) and the high five
    'HIGH FIVE': '击掌', '✋ HIGH FIVE!': '✋ 击掌！', '👀 SPOT THE HIDING ONES!': '👀 找找藏起来的！', '🛡️ Saved!': '🛡️ 救回来了！',
    'he has your back once': '他会帮你一次',
    '👋 VS COMPUTER: call your brother any time with T or his face! Two players: T is a HIGH FIVE.': '👋 对战电脑：随时按 T 或点他的脸叫兄弟来帮忙！双人：T 是击掌。',
    'call your brother · high five': '叫兄弟 · 击掌',
    "Two players: your count is hidden (it shows ●● whatever the number), so the other player can't read it. VS Computer: type the number any time, even while you're still counting, and it locks by itself (1 and 2 wait a moment for a second digit). Call your brother as often as you like: he spots your hiding animals and has your back once.":
      '双人：你的数字是藏起来的（不管多少都显示 ●●），对方看不到。对战电脑：随时都能输入数字，数的时候也可以，会自动锁定（1 和 2 会等一下第二位数字）。兄弟随时可以叫：他帮你找藏起来的动物，还会救你一次。',
    "Drag on your side to move your binoculars. Tap your power button while you count. Sure already? Tap ✋ READY. When the binoculars shut, tap your number from 0 to 20: that locks it. Tap your brother's face to call him (two players: the high five on the fence). Two players on an iPad: each taps on their own side.":
      '在自己那边拖动来移动望远镜。数的时候点你的本领按钮。已经数好了？点 ✋ 数好了。望远镜关上以后，点 0 到 20 里你的数字，就锁定了。点兄弟的脸叫他来（双人：栅栏上的击掌按钮）。两个人用 iPad：各点自己那一边。',
    // the ? panel (js/keys.js)
    'Player 1 (left)': '玩家 1（左边）', 'Player 2 (right)': '玩家 2（右边）',
    'VS Computer: type the number': '对战电脑：输入数字',
    'next round · pause · sound': '下一轮 · 暂停 · 声音',
  });

  L.rule(/^ROUND (\d+) OF (\d+)$/, '第 $1 轮（共 $2 轮）');
  L.rule(/^count the (\w+)! (\S+) · (☀️ DAY|🌙 NIGHT)$/, (m, a, e, s) => `数一数${AN[a] || a}！${e} · ${SKY[s]}`);
  L.rule(/^HOW MANY (\w+)\?$/, (m, a) => `有几${MW[a] || '只'}${AN[a] || a}？`);
  L.rule(/^(☀️ DAY|🌙 NIGHT) · (\S+) (\w+) · (\S+) (EASY|MEDIUM|HARD)$/, (m, s, e, a, d, dd) => `${SKY[s]} · ${e} ${AN[a] || a} · ${d} ${DIFF[dd]}`);
  L.rule(/^(\d+) s$/, '$1 秒');
  L.rule(/^⏳ (\d+) s$/, '⏳ $1 秒');
  L.rule(/^(\S+) READY$/, '$1 好了');
  L.rule(/^(PLAYER [12]) WINS THE ROUND!$/, (m, w) => `这一轮${WHO[w]}赢了！`);
  L.rule(/^SCORE (\d+) – (\d+) · ROUND (\d+) OF (\d+)$/, '比分 $1 – $2 · 第 $3 轮（共 $4 轮）');
  L.rule(/^🔒 (\d+) more wins?$/, '🔒 再赢 $1 局');
  L.rule(/^🔒 win (\d+) more games?$/, '🔒 再赢 $1 局');
  L.rule(/^Freezes his animals for (\d+) s so they're easy to count\. Then (\d+) s to recharge\.$/, '把他的动物冻住 $1 秒，就好数了。然后要等 $2 秒才能再用。');
  L.rule(/^Helicopter pilot\. At night his helicopter lights up his binoculars for (\d+) s\. Then (\d+) s to recharge\. Night only\.$/, '直升机飞行员。晚上他的直升机会照亮他的望远镜 $1 秒。然后要等 $2 秒。只能晚上用。');
  L.rule(/^🏆 Games won: (\d+) · (\d+) more to unlock (\S+)$/, '🏆 赢了 $1 局 · 再赢 $2 局解锁 $3');
  L.rule(/^🏆 Games won: (\d+) · every character unlocked!$/, '🏆 赢了 $1 局 · 所有角色都解锁了！');
  L.rule(/^🏆 Games won: (\d+) · (\d+) more wins? to unlock (\S+) (\S+)$/, '🏆 赢了 $1 局 · 再赢 $2 局解锁 $3 $4');
  L.rule(/^🔓 NEW CHARACTER: (\S+) (\S+) THE HELICOPTER PILOT!$/, '🔓 新角色：$1 直升机飞行员 $2！');
  L.rule(/^(\d+) – (\d+) after (\d+) rounds$/, '$3 轮后 $1 – $2');
  L.rule(/^(\d+) – (\d+) · try again!$/, '$1 – $2 · 再来一次！');
  L.rule(/^YOU · (\d+) – (\d+)$/, '你 · $1 – $2');
  L.rule(/^(PLAYER [12]) \((\S+)\) · (\d+) – (\d+)$/, (m, w, n, a, b) => `${WHO[w]}（${n}）· ${a} – ${b}`);
  L.rule(/^(\d+)\. $/, '$1. ');
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, e, t, who) => `${e} ${who} 送来的${TREAT[t]}！`);
  L.rule(/^CALL (\S+)$/, '叫 $1');
  L.rule(/^(\S+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^🛡️ (\S+) SAVED YOU!$/, '🛡️ $1 救了你！');
  L.rule(/^🛡️ (\S+) ANSWERED FOR YOU!$/, '🛡️ $1 帮你答了！');
  L.rule(/^👀 (\S+) IS SPOTTING!$/, '👀 $1 在帮你找！');
  L.rule(/^🛡️ (\S+) SAVED YOU (\d+) TIMES?!$/, '🛡️ $1 救了你 $2 次！');
})();
