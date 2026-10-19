/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: SPOT.TITLE, // the name lives in js/title.js
  cols: ['Player 1 (left)', 'Player 2 (right)'],
  keys: [
    ['move your binoculars (or just use the mouse)', 'W A S D', '↑ ← ↓ →'],
    ['count +1 · −1 (your hidden clicker)', 'E Q', '> <'],
    ['use your power ❄️ freeze · 🚁 spotlight', 'F', '/'],
    ['I\'m ready · lock your answer (you have 30 s)', 'Space', 'Enter'],
    ['VS Computer: type the number', '0 – 9 · Backspace', ''],
    ['call your brother · high five', 'T', ''],
    ['next round · pause · sound', 'Enter · P or Esc · M', ''],
  ],
  note: 'Two players: your count is hidden (it shows ●● whatever the number), so the other player can\'t read it. VS Computer: type the number any time, even while you\'re still counting, and it locks by itself (1 and 2 wait a moment for a second digit). Call your brother as often as you like: he spots your hiding animals and has your back once.',
  touch: 'Drag on your side to move your binoculars. Tap your power button while you count. Sure already? Tap ✋ READY. When the binoculars shut, tap your number from 0 to 20: that locks it. Tap your brother\'s face to call him (two players: the high five on the fence). Two players on an iPad: each taps on their own side.',
});
