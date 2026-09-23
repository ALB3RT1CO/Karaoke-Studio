import React from 'react';
import { motion, type MotionValue, useTransform } from 'framer-motion';
import type { WordTiming } from './syncEngine.ts';

export interface KaraokeWordProps {
  word: WordTiming;
  currentTime: MotionValue<number>;
  chord?: string;
  activeColor?: string;
  baseColor?: string;
  className?: string;
}

/**
 * Word-Level Karaoke Component.
 * Uses Framer Motion's useTransform and direct style binding to achieve
 * smooth 60fps GPU-accelerated width clipping with zero React re-renders.
 */
export const KaraokeWord: React.FC<KaraokeWordProps> = ({
  word,
  currentTime,
  chord,
  activeColor = '#22d3ee',
  baseColor = '#6b7280',
  className = '',
}) => {
  const safeEnd = word.end > word.start ? word.end : word.start + 0.0001;

  // Map playback time to percentage fill [0% -> 100%]
  const fillProgress = useTransform(
    currentTime,
    [word.start, safeEnd],
    ['0%', '100%'],
    { clamp: true }
  );

  return (
    <span
      className={`relative inline-block mx-1 font-bold text-2xl ${className}`}
      data-testid="karaoke-word"
      data-word={word.text}
    >
      {chord && (
        <span
          className="absolute -top-5 left-0 text-xs font-semibold text-amber-400 select-none pointer-events-none"
          data-testid="chord-annotation"
        >
          {chord}
        </span>
      )}

      {/* Base dimmed word */}
      <span
        className="select-none"
        style={{ color: baseColor }}
        data-testid="word-base"
      >
        {word.text}
      </span>

      {/* Synchronized color fill overlay */}
      <motion.span
        className="absolute top-0 left-0 overflow-hidden whitespace-pre pointer-events-none select-none"
        style={{ width: fillProgress, color: activeColor }}
        aria-hidden="true"
        data-testid="word-fill"
      >
        {word.text}
      </motion.span>
    </span>
  );
};
