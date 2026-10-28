"""emet addition to MiroFish: MP3 / MP4 / M4A / WAV / MOV → text, with ffmpeg + Groq Whisper (same key as the LLM)."""
import os
import subprocess
import tempfile
from pathlib import Path

from openai import OpenAI

MEDIA_EXTENSIONS = {'.mp3', '.mp4', '.m4a', '.wav', '.mov'}
# 10 min of 32 kbps mono audio ≈ 2.4 MB, well under Groq's 25 MB per file
SEGMENT_SECONDS = 600


def transcribe(file_path: str) -> str:
    client = OpenAI(api_key=os.environ['LLM_API_KEY'], base_url=os.environ.get('LLM_BASE_URL'))
    model = os.environ.get('WHISPER_MODEL', 'whisper-large-v3-turbo')
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', file_path, '-vn', '-ac', '1', '-ar', '16000',
                        '-b:a', '32k', '-f', 'segment', '-segment_time', str(SEGMENT_SECONDS),
                        os.path.join(tmp, 'part%03d.mp3')], check=True)
        texts = []
        for part in sorted(Path(tmp).glob('part*.mp3')):
            with open(part, 'rb') as f:
                texts.append(client.audio.transcriptions.create(model=model, file=f).text.strip())
    # Whisper answers silence with ". . ." — punctuation only counts as no speech
    text = '\n\n'.join(t for t in texts if any(c.isalnum() for c in t))
    if not text:
        raise ValueError('No speech found in the file')
    return text
