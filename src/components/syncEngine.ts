import { motionValue, transform, type MotionValue } from 'framer-motion';

export interface WordTiming {
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface LyricLine {
  lineIndex: number;
  start: number;
  end: number;
  chord?: string; // Musical chord tag (e.g. "Do#m", "Sol")
  words: WordTiming[];
}

export interface SongKaraokeTrack {
  id?: string;
  songId?: string;
  title?: string;
  driveMd5Checksum?: string;
  youtubeVideoId?: string;
  duration?: number;
  lines: LyricLine[];
}

/**
 * Calculates progress for a word between 0 and 1, strictly clamped.
 * Gracefully handles zero-duration or inverted duration edge cases.
 */
export function calculateWordProgress(currentTime: number, start: number, end: number): number {
  if (end <= start) {
    return currentTime >= start ? 1 : 0;
  }
  if (currentTime <= start) {
    return 0;
  }
  if (currentTime >= end) {
    return 1;
  }
  return (currentTime - start) / (end - start);
}

/**
 * Formats a 0-1 progress number as a percentage string with two decimals (e.g. "50.00%").
 */
export function formatProgressPercent(progress: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  return `${(clamped * 100).toFixed(2)}%`;
}

/**
 * Generates CSS properties for a background-clip: text gradient fill.
 */
export function getWordFillGradient(
  fillPercent: string,
  highlightColor: string = '#22d3ee',
  baseColor: string = '#6b7280'
): Record<string, string> {
  const gradient = `linear-gradient(to right, ${highlightColor} ${fillPercent}, ${baseColor} ${fillPercent})`;
  return {
    backgroundImage: gradient,
    WebkitBackgroundImage: gradient,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };
}

/**
 * Creates a reactive Framer Motion MotionValue<string> representing the fill percentage
 * of a word ('0%' to '100%'), clamped, updating synchronously without React re-renders.
 */
export function createWordTransform(
  currentTime: MotionValue<number>,
  start: number,
  end: number
): MotionValue<string> {
  if (end <= start) {
    const initial = currentTime.get() >= start ? '100%' : '0%';
    const derived = motionValue(initial);
    currentTime.on('change', (latest: number) => {
      derived.set(latest >= start ? '100%' : '0%');
    });
    return derived;
  }

  const transformer = transform([start, end], ['0%', '100%'], { clamp: true });
  const initial = transformer(currentTime.get());
  const derived = motionValue(initial);

  currentTime.on('change', (latest: number) => {
    derived.set(transformer(latest));
  });

  return derived;
}
