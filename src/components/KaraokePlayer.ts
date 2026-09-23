import React, { useEffect, useRef } from 'react';
import { useMotionValue } from 'framer-motion';
import { KaraokeWord } from './KaraokeWord.ts';
import type { SongKaraokeTrack } from './syncEngine.ts';

export interface KaraokePlayerProps {
  track: SongKaraokeTrack;
  onTimeUpdate?: (time: number) => void;
  className?: string;
  activeColor?: string;
  baseColor?: string;
}

/**
 * YouTube IFrame & MotionValue Sync Engine Player.
 * Synchronizes playback with zero React re-renders by updating a Framer Motion
 * MotionValue at 60fps via YouTube postMessage API and requestAnimationFrame.
 */
export const KaraokePlayer: React.FC<KaraokePlayerProps> = ({
  track,
  onTimeUpdate,
  className = '',
  activeColor,
  baseColor,
}) => {
  const currentTime = useMotionValue(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (onTimeUpdate) {
      unsubscribe = currentTime.on('change', (latest) => {
        onTimeUpdate(latest);
      });
    }

    let animId: number;
    const pollLoop = () => {
      if (typeof window !== 'undefined') {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage(
              JSON.stringify({ event: 'listening' }),
              '*'
            );
          } catch {
            // Ignore cross-origin errors
          }
        }
        animId = requestAnimationFrame(pollLoop);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            currentTime.set(data.info.currentTime);
          }
        }
      } catch {
        // Ignore non-json postMessages
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
      animId = requestAnimationFrame(pollLoop);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', handleMessage);
        cancelAnimationFrame(animId);
      }
    };
  }, [currentTime, onTimeUpdate]);

  const embedUrl = track.youtubeVideoId
    ? `https://www.youtube.com/embed/${track.youtubeVideoId}?enablejsapi=1`
    : '';

  return React.createElement(
    'div',
    {
      className: `karaoke-player flex flex-col items-center gap-6 p-4 ${className}`,
      'data-testid': 'karaoke-player',
    },
    track.youtubeVideoId
      ? React.createElement(
          'div',
          { className: 'w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black' },
          React.createElement('iframe', {
            ref: iframeRef,
            src: embedUrl,
            title: track.title || 'Karaoke Track',
            className: 'w-full h-full border-0',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            allowFullScreen: true,
            'data-testid': 'youtube-iframe',
          })
        )
      : null,
    React.createElement(
      'div',
      {
        className: 'w-full max-w-3xl flex flex-col gap-6 text-center my-4',
        'data-testid': 'lyrics-container',
      },
      track.lines.map((line) =>
        React.createElement(
          'div',
          {
            key: line.lineIndex,
            className: 'lyric-line relative py-2 px-4 transition-all',
            'data-testid': 'lyric-line',
            'data-line-index': line.lineIndex,
          },
          line.words.map((word, wIdx) =>
            React.createElement(KaraokeWord, {
              key: `${line.lineIndex}-${wIdx}`,
              word,
              currentTime,
              chord: wIdx === 0 ? line.chord : undefined,
              activeColor,
              baseColor,
            })
          )
        )
      )
    )
  );
};
