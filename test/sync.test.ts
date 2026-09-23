import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { motionValue } from 'framer-motion';

import {
  calculateWordProgress,
  formatProgressPercent,
  getWordFillGradient,
  createWordTransform,
  type WordTiming,
  type LyricLine,
  type SongKaraokeTrack,
} from '../src/components/syncEngine.ts';

import { KaraokeWord } from '../src/components/KaraokeWord.ts';
import { KaraokePlayer } from '../src/components/KaraokePlayer.ts';

test('calculateWordProgress - boundary points and edge cases', () => {
  const start = 1.0;
  const end = 3.0;

  // Before start -> 0
  assert.equal(calculateWordProgress(0.0, start, end), 0);
  assert.equal(calculateWordProgress(0.99, start, end), 0);

  // At start -> 0
  assert.equal(calculateWordProgress(1.0, start, end), 0);

  // Halfway -> 0.5
  assert.equal(calculateWordProgress(2.0, start, end), 0.5);

  // At 75% -> 0.75
  assert.equal(calculateWordProgress(2.5, start, end), 0.75);

  // At end -> 1
  assert.equal(calculateWordProgress(3.0, start, end), 1);

  // After end -> 1
  assert.equal(calculateWordProgress(3.01, start, end), 1);
  assert.equal(calculateWordProgress(10.0, start, end), 1);

  // Zero-duration edge case (start === end)
  assert.equal(calculateWordProgress(1.99, 2.0, 2.0), 0);
  assert.equal(calculateWordProgress(2.0, 2.0, 2.0), 1);
  assert.equal(calculateWordProgress(2.01, 2.0, 2.0), 1);

  // Negative/invalid duration edge case (end < start)
  assert.equal(calculateWordProgress(1.0, 3.0, 2.0), 0);
  assert.equal(calculateWordProgress(3.0, 3.0, 2.0), 1);
  assert.equal(calculateWordProgress(4.0, 3.0, 2.0), 1);
});

test('formatProgressPercent - formats clamped percentage with two decimals', () => {
  assert.equal(formatProgressPercent(0), '0.00%');
  assert.equal(formatProgressPercent(0.5), '50.00%');
  assert.equal(formatProgressPercent(1), '100.00%');
  assert.equal(formatProgressPercent(0.33333), '33.33%');
  assert.equal(formatProgressPercent(0.75), '75.00%');

  // Clamping
  assert.equal(formatProgressPercent(-0.25), '0.00%');
  assert.equal(formatProgressPercent(1.25), '100.00%');
});

test('getWordFillGradient - outputs valid CSS background-clip gradient styles', () => {
  const defaultGradient = getWordFillGradient('50.00%');
  assert.equal(typeof defaultGradient, 'object');
  assert.ok(defaultGradient.backgroundImage.includes('linear-gradient'));
  assert.ok(defaultGradient.backgroundImage.includes('50.00%'));
  assert.equal(defaultGradient.backgroundClip, 'text');
  assert.equal(defaultGradient.WebkitBackgroundClip, 'text');
  assert.equal(defaultGradient.color, 'transparent');
  assert.equal(defaultGradient.WebkitTextFillColor, 'transparent');

  // Custom colors
  const customGradient = getWordFillGradient('75.00%', '#ff0077', '#333333');
  assert.ok(customGradient.backgroundImage.includes('#ff0077'));
  assert.ok(customGradient.backgroundImage.includes('#333333'));
  assert.ok(customGradient.backgroundImage.includes('75.00%'));
});

test('createWordTransform - Framer Motion mapping at start, mid, end without drift', () => {
  const currentTime = motionValue(0);
  const start = 2.0;
  const end = 6.0;

  const transform = createWordTransform(currentTime, start, end);

  // Initial at 0 (before start)
  assert.equal(transform.get(), '0%');

  // At start
  currentTime.set(2.0);
  assert.equal(transform.get(), '0%');

  // At mid (4.0s)
  currentTime.set(4.0);
  assert.equal(transform.get(), '50%');

  // At end (6.0s)
  currentTime.set(6.0);
  assert.equal(transform.get(), '100%');

  // After end (8.0s)
  currentTime.set(8.0);
  assert.equal(transform.get(), '100%');

  // Instantaneous seek forward without drift
  currentTime.set(100.0);
  assert.equal(transform.get(), '100%');

  // Instantaneous seek backward without drift
  currentTime.set(0.0);
  assert.equal(transform.get(), '0%');

  // Seek back to 25% (3.0s)
  currentTime.set(3.0);
  assert.equal(transform.get(), '25%');

  // Zero-duration edge case in transform
  const zeroDurationTime = motionValue(1.0);
  const zeroTransform = createWordTransform(zeroDurationTime, 2.0, 2.0);
  assert.equal(zeroTransform.get(), '0%');
  zeroDurationTime.set(2.0);
  assert.equal(zeroTransform.get(), '100%');
  zeroDurationTime.set(3.0);
  assert.equal(zeroTransform.get(), '100%');
  zeroDurationTime.set(1.5);
  assert.equal(zeroTransform.get(), '0%');
});

test('KaraokeWord - renders word text, handles chord floating above word, and syncs fill', () => {
  const word: WordTiming = {
    text: 'Amazing',
    start: 1.0,
    end: 3.0,
  };

  const currentTime = motionValue(1.0);

  // 1. Without chord
  const markupNoChord = renderToStaticMarkup(
    React.createElement(KaraokeWord, {
      word,
      currentTime,
    })
  );

  assert.ok(markupNoChord.includes('Amazing'), 'Must render word text');
  assert.ok(!markupNoChord.includes('data-testid="chord-annotation"'), 'Must not render chord when omitted');
  assert.ok(markupNoChord.includes('width:0%'), 'Initial width at start should be 0%');

  // 2. With chord
  const markupWithChord = renderToStaticMarkup(
    React.createElement(KaraokeWord, {
      word,
      currentTime,
      chord: 'Do#m',
    })
  );

  assert.ok(markupWithChord.includes('Do#m'), 'Must render chord annotation');
  assert.ok(markupWithChord.includes('data-testid="chord-annotation"'), 'Chord element has testid');

  // 3. Halfway fill verification (Task 2.2 target: 50% when halfway)
  currentTime.set(2.0);
  const markupHalfway = renderToStaticMarkup(
    React.createElement(KaraokeWord, {
      word,
      currentTime,
      chord: 'Do#m',
    })
  );
  assert.ok(markupHalfway.includes('width:50%'), 'Fill width must be 50% at halfway');

  // 4. End fill verification
  currentTime.set(3.0);
  const markupEnd = renderToStaticMarkup(
    React.createElement(KaraokeWord, {
      word,
      currentTime,
    })
  );
  assert.ok(markupEnd.includes('width:100%'), 'Fill width must be 100% at end');
});

test('KaraokePlayer - embeds YouTube IFrame with enablejsapi and renders lyric lines and words', () => {
  const sampleTrack: SongKaraokeTrack = {
    id: 'test-song-1',
    title: 'Test Song',
    youtubeVideoId: 'dQw4w9WgXcQ',
    lines: [
      {
        lineIndex: 0,
        start: 1.0,
        end: 4.0,
        chord: 'Sol',
        words: [
          { text: 'Never', start: 1.0, end: 2.0 },
          { text: 'gonna', start: 2.0, end: 3.0 },
          { text: 'give', start: 3.0, end: 4.0 },
        ],
      },
      {
        lineIndex: 1,
        start: 4.5,
        end: 7.0,
        chord: 'Re',
        words: [
          { text: 'you', start: 4.5, end: 5.5 },
          { text: 'up', start: 5.5, end: 7.0 },
        ],
      },
    ],
  };

  let receivedTime = -1;
  const markup = renderToStaticMarkup(
    React.createElement(KaraokePlayer, {
      track: sampleTrack,
      onTimeUpdate: (t: number) => {
        receivedTime = t;
      },
    })
  );

  // Verify YouTube iframe embed
  assert.ok(markup.includes('iframe'), 'Must render an iframe element');
  assert.ok(
    markup.includes('https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1'),
    'Must embed YouTube iframe with videoId and enablejsapi=1'
  );

  // Verify all words are rendered
  assert.ok(markup.includes('Never'), 'Should render word Never');
  assert.ok(markup.includes('gonna'), 'Should render word gonna');
  assert.ok(markup.includes('give'), 'Should render word give');
  assert.ok(markup.includes('you'), 'Should render word you');
  assert.ok(markup.includes('up'), 'Should render word up');

  // Verify chord annotations are rendered
  assert.ok(markup.includes('Sol'), 'Should render chord Sol');
  assert.ok(markup.includes('Re'), 'Should render chord Re');
});
