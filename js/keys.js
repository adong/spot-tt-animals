/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: SPOT.TITLE, // the name lives in js/title.js
  cols: ['Player 1 (left)', 'Player 2 (right)'],
  keys: [
    ['count +1 · −1 (your hidden clicker)', 'W S', '↑ ↓'],
    ['use your power ❄️ freeze · 🚁 spotlight', 'A or Space', '← or Enter'],
    ['lock your answer (you have 3 s!)', 'D or Space', '→ or Enter'],
    ['VS Computer: type the number', '0 – 9 · Backspace', ''],
    ['next round · pause · sound', 'Enter · P or Esc · M', ''],
  ],
  note: 'Two players: your count is hidden (it shows ●● whatever the number), so the other player can\'t read it. VS Computer: type the number and it locks by itself (1 and 2 wait a moment for a second digit).',
  touch: 'Tap your power button while you count. When the binoculars shut, tap your number from 0 to 20: that locks it. Two players on an iPad: each taps on their own side.',
});
