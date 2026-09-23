import { google, type youtube_v3 } from 'googleapis';
import {
  Store,
  defaultStore,
  type SongKaraokeTrack,
} from '../store.ts';
import { cleanSongTitle } from './drive.ts';

// Re-export cleanSongTitle for convenience and unified mapping API
export { cleanSongTitle };

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
}

export interface MapSongOptions {
  store?: Store;
  youtubeClient?: any;
  force?: boolean;
}

/**
 * Creates an authenticated YouTube Data API v3 client.
 * Prioritizes the apiKey parameter, then falls back to process.env.YOUTUBE_API_KEY.
 */
export function getYouTubeClient(apiKey?: string): youtube_v3.Youtube {
  const key = apiKey || process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error('YOUTUBE_API_KEY environment variable is not defined.');
  }

  return google.youtube({ version: 'v3', auth: key });
}

/**
 * Formulates a search query for YouTube using the cleaned song title.
 * Strips chord tags, extensions, and appends "official audio".
 */
export function buildYouTubeSearchQuery(songTitle: string): string {
  const clean = cleanSongTitle(songTitle).trim();
  if (!clean) {
    return '';
  }
  return `${clean} official audio`;
}

/**
 * Searches the YouTube Data API for the single best matching video.
 * Enforces `type: ['video']` and `maxResults: 1`.
 * Handles quota exceeded (HTTP 403) and network failures gracefully without throwing.
 */
export async function searchSongVideo(
  query: string,
  youtubeClient?: any
): Promise<YouTubeSearchResult | null> {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return null;
  }

  try {
    const youtube = youtubeClient || getYouTubeClient();
    const res = await youtube.search.list({
      part: ['snippet'],
      q: trimmedQuery,
      maxResults: 1,
      type: ['video'],
    });

    const items = res.data?.items;
    if (!items || items.length === 0) {
      return null;
    }

    const item = items[0];
    const videoId = typeof item.id === 'string' ? item.id : item.id?.videoId;
    if (!videoId) {
      return null;
    }

    const title = item.snippet?.title || item.title || '';
    return { videoId, title };
  } catch (err: any) {
    const isQuotaExceeded =
      err?.code === 403 ||
      err?.status === 403 ||
      err?.errors?.[0]?.reason === 'quotaExceeded' ||
      /quota/i.test(err?.message || '');

    if (isQuotaExceeded) {
      console.warn(`[YouTube] Quota exceeded while searching for "${trimmedQuery}":`, err?.message || err);
    } else {
      console.warn(`[YouTube] Search error for "${trimmedQuery}":`, err?.message || err);
    }
    return null;
  }
}

/**
 * Maps a song in the Store to its corresponding YouTube video ID.
 * Implements strict Cache-First Quota Protection:
 * - If song.youtubeVideoId already exists and !force, returns immediately without API query.
 * - Formulates search query from clean title, queries YouTube API.
 * - Updates song in store and persists via store.upsertSong.
 * - Returns updated SongKaraokeTrack.
 */
export async function mapSongToYouTube(
  songId: string,
  options?: MapSongOptions
): Promise<SongKaraokeTrack> {
  const store = options?.store || defaultStore;
  const force = options?.force ?? false;

  const song = store.getSong(songId);
  if (!song) {
    throw new Error(`Song with ID "${songId}" not found in store.`);
  }

  // Cache-first strategy: If already mapped and not forcing refresh, return cached song
  if (song.youtubeVideoId && !force) {
    return song;
  }

  const query = buildYouTubeSearchQuery(song.title || song.id);
  const searchResult = await searchSongVideo(query, options?.youtubeClient);

  if (!searchResult || !searchResult.videoId) {
    return song;
  }

  const updatedSong: SongKaraokeTrack = {
    ...song,
    youtubeVideoId: searchResult.videoId,
  };

  store.upsertSong(updatedSong);
  return updatedSong;
}
