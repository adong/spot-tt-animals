/* Spot TT Animals: every number in one place, in two parts.

   SPOT.RULES  - Teddy's rules from his design document ("Part 15: Non-Negotiable Game Rules"). They are fixed:
                 `node tools/check.js` fails if anyone changes them, here or in SPOT.CONFIG.
   SPOT.CONFIG - the balancing values, shaped like the GAME_CONFIG in his document. Anything marked PROPOSAL is a
                 prototype default that Teddy hasn't decided yet: change it freely and run the check again.

   No Three.js in here: the rules (js/sim.js), the computer player (js/brain.js) and the check (js/check.js) read
   this in the browser and in Node. */
(function () {
  'use strict';
  const SPOT = (window.SPOT = window.SPOT || {});
  const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };

  SPOT.RULES = deepFreeze({
    animalTypes: ['chicken', 'cow', 'sheep', 'rooster', 'hen'], // rule 1: one type per round, never a mixture
    roundsPerGame: 5, // rule 2
    observeSeconds: { easy: 60, medium: 30, hard: 15 }, // rule 3: the counting time, not the answer time
    answerSeconds: 3, // rule 4
    maxAnimals: 20, // rule 8 (and answers are numbers from 0 to 20)
    minAnimals: 0, // rule 9: zero is possible (but extremely rare)
    zeroOnlyOnePlayer: true, // rule 10
    bothRightIsDraw: true, // rule 18
    // From the round sequence in Part 4 (not in the list of 19, but spelled out by Teddy's document):
    readyCountdown: 3, // "3... 2... 1... GO!"
    finalCountdown: 5, // "5... 4... 3... 2... 1..." over the last five seconds
  });

  SPOT.CONFIG = {
    // ---- copies of Teddy's rules, kept here so the shape matches his GAME_CONFIG (the check makes sure they agree)
    roundsPerGame: 5,
    difficulty: { easy: 60, medium: 30, hard: 15 },
    answerTimeSeconds: 3,

    animals: {
      min: 1, // a normal field has 1 to 20 animals
      max: 20,
      allowRareZero: true,
      zeroProbability: 0.01, // PROPOSAL: a 1% chance per round that ONE player's field is empty (from his document)
    },

    characters: {
      teddy: {
        ability: 'wide_view', // always on: bigger binoculars
        viewMultiplier: 1.5, // PROPOSAL: how much bigger Teddy's binoculars are (wider and taller)
      },
      tommy: {
        ability: 'freeze',
        freezeDurationSeconds: 3, // PROPOSAL (undecided in Part 14)
        cooldownSeconds: 12, // PROPOSAL: the document's "12s" example. The cooldown itself is a rule (13).
      },
      pilot: {
        ability: 'spotlight',
        durationSeconds: 5, // PROPOSAL
        cooldownSeconds: 15, // PROPOSAL
        nightOnly: true, // from the document: the helicopter is a night-mode power
        who: 'zoom', // PROPOSAL: who the pilot is is undecided. Zoom from the kit, with his headphones.
      },
    },

    // PROPOSAL: who you start with and how you unlock the rest (all undecided in Part 14).
    roster: {
      start: ['teddy', 'tommy'],
      unlocks: [{ id: 'pilot', wins: 2 }], // the helicopter pilot after 2 games won
      // Kit characters shown as locked "mystery" cards until Teddy invents their powers (no made-up powers here).
      mystery: ['luna', 'bolt', 'bruno'],
    },

    scoring: {
      roundWin: 1, // PROPOSAL (from the document): a point for winning a round
      draw: 0, // ... and none for a draw. Equal points after five rounds = the match is a draw.
      bothWrong: 'draw', // PROPOSAL: 'draw' (the document's prototype rule) or 'closest' (closest answer wins)
    },

    timing: {
      roundBanner: 1.4, // "ROUND 1 OF 5" shows this long before 3... 2... 1...
      countdownStep: 1, // each of 3, 2, 1
      typedConfirm: 0.8, // typing a 1 or 2 waits this long for a second digit (10-20), then locks by itself
      endAnswerWhenBothLocked: true, // the 3 s can end early when both answers are in
    },

    // PROPOSAL: powers are fresh (no cooldown) at the start of every round.
    powers: { resetEachRound: true },

    // PROPOSAL: the computer player (Part 9 suggestions).
    cpu: {
      accuracy: { easy: 0.6, medium: 0.75, hard: 0.9 }, // chance its answer is right
      // small nudges for its own powers and the dark. Set them all to 0 to get exactly the numbers above.
      mods: { wideView: 0.04, freeze: 0.04, night: -0.1, spotlightAtNight: 0.08 },
      answerDelay: [0.7, 2.1], // seconds into the 3 s answer window before it locks
      powerWait: [1.5, 6], // seconds it waits after its power is ready before using it
    },

    // PROPOSAL: on 'mix' nights and days are picked at random each round (both players share one).
    sky: { mixNightChance: 0.5 },

    // The field and the binoculars, in game units. Each player's field is the same size.
    field: {
      width: 18,
      depth: 12,
      // 0..1: how much the animals like the middle of the field (where the binoculars look). With these sizes the
      // normal binoculars show about 43% of the field and about 81% of the animals at a time; Teddy's show about
      // 91% of the field and nearly all of the animals (node tools/check.js --soak prints the numbers).
      centerPull: 0.3,
    },
    lens: {
      radius: 3.9, // each of the two round lenses, for everyone but Teddy (his is x viewMultiplier)
      lobe: 0.55, // the lenses' centres sit this many radii left and right of the middle
      tilt: 58, // degrees: how steeply the binoculars look down into the field
    },

    // How each animal moves. speed in units a second, graze = how long it stops to eat, r = how much room it needs.
    movement: {
      cow: { speed: 0.9, graze: [1.6, 4.2], r: 0.85, turn: 2.4 },
      sheep: { speed: 1.15, graze: [1.0, 3.2], r: 0.62, turn: 3.2 },
      chicken: { speed: 1.75, graze: [0.4, 1.6], r: 0.38, turn: 6 },
      hen: { speed: 1.35, graze: [0.6, 2.2], r: 0.42, turn: 5 },
      rooster: { speed: 1.55, graze: [0.5, 1.9], r: 0.42, turn: 5.5 },
    },
  };
})();
