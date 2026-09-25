import os
import json
import subprocess
import tempfile
import sys

# REQUIRED DEPENDENCIES:
# pip install yt-dlp whisper-timestamped torch
# ffmpeg must be installed and in PATH

try:
    import whisper_timestamped as whisper
except ImportError:
    print("Error: Missing whisper-timestamped. Please run: pip install whisper-timestamped")
    sys.exit(1)

DATA_JSONL = os.path.join(os.path.dirname(__file__), '..', 'data.jsonl')

def process_song(song):
    video_id = song.get('youtubeVideoId')
    if not video_id:
        return
        
    print(f"Processing: {song['title']} ({video_id})")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        audio_path = os.path.join(temp_dir, 'audio.wav')
        
        # 1. Download audio using yt-dlp
        url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"  -> Downloading audio from {url}...")
        subprocess.run([
            'yt-dlp', 
            '-x', '--audio-format', 'wav',
            '--output', audio_path,
            url
        ], check=True, stdout=subprocess.DEVNULL)
        
        # 2. Run Forced Alignment (Whisper)
        print("  -> Running Whisper ML Alignment...")
        audio = whisper.load_audio(audio_path)
        model = whisper.load_model("tiny")
        
        # We use whisper to transcribe and align timestamps
        result = whisper.transcribe(model, audio, language="es")
        
        # 3. Match transcription timings to our database words
        # (This is a simplified alignment heuristic)
        whisper_words = []
        for segment in result['segments']:
            for w in segment['words']:
                whisper_words.append(w)
                
        # Re-assign timestamps in the song lines
        w_idx = 0
        for line in song.get('lines', []):
            for word in line.get('words', []):
                if w_idx < len(whisper_words):
                    ml_word = whisper_words[w_idx]
                    word['start'] = round(ml_word['start'], 2)
                    word['end'] = round(ml_word['end'], 2)
                    w_idx += 1
                    
        print(f"  -> Successfully aligned {w_idx} words!")

def main():
    if not os.path.exists(DATA_JSONL):
        print("data.jsonl not found!")
        return

    songs = []
    with open(DATA_JSONL, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                event = json.loads(line)
                if event['type'] == 'UPSERT_SONG':
                    songs.append(event['payload'])
                    
    # Only process the first song for testing
    process_song(songs[0])
    
    # Save back to data.jsonl
    with open(DATA_JSONL, 'w', encoding='utf-8') as f:
        for song in songs:
            event = {
                "type": "UPSERT_SONG",
                "payload": song,
                "timestamp": "2026-09-22T00:00:00.000Z" # Dummy timestamp for update
            }
            f.write(json.dumps(event) + '\n')
            
    print("Updated data.jsonl with ML timestamps!")

if __name__ == '__main__':
    main()
