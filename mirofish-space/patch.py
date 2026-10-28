"""emet's only changes to MiroFish, applied at build time. Each one must match exactly, or the build stops.
Usage: python3 patch.py <MiroFish folder>"""
import sys
from pathlib import Path

root = Path(sys.argv[1])
MEDIA = "'mp3', 'mp4', 'm4a', 'wav', 'mov'"


def patch(rel: str, old: str, new: str) -> None:
    f = root / rel
    s = f.read_text(encoding='utf-8')
    assert s.count(old) == 1, f'{rel}: expected exactly one {old!r}'
    f.write_text(s.replace(old, new), encoding='utf-8')


# English by default instead of Chinese (the language menu still switches)
patch('frontend/src/i18n/index.js', "localStorage.getItem('locale') || 'zh'", "localStorage.getItem('locale') || 'en'")

# Audio and video: transcribed to text (media.py), then used like any document
patch('backend/app/config.py', "ALLOWED_EXTENSIONS = {'pdf', 'md', 'txt', 'markdown'}",
      f"ALLOWED_EXTENSIONS = {{'pdf', 'md', 'txt', 'markdown', {MEDIA}}}")
patch('backend/app/config.py', 'MAX_CONTENT_LENGTH = 50 * 1024 * 1024', 'MAX_CONTENT_LENGTH = 500 * 1024 * 1024')
patch('backend/app/utils/file_parser.py', "SUPPORTED_EXTENSIONS = {'.pdf', '.md', '.markdown', '.txt'}",
      "SUPPORTED_EXTENSIONS = {'.pdf', '.md', '.markdown', '.txt', '.mp3', '.mp4', '.m4a', '.wav', '.mov'}")
patch('backend/app/utils/file_parser.py', "        if suffix == '.pdf':\n",
      "        if suffix in {'.mp3', '.mp4', '.m4a', '.wav', '.mov'}:\n"
      "            from .media import transcribe\n"
      "            return transcribe(file_path)\n"
      "        if suffix == '.pdf':\n")
patch('frontend/src/views/Home.vue', 'accept=".pdf,.md,.txt"', 'accept=".pdf,.md,.txt,.mp3,.mp4,.m4a,.wav,.mov"')
patch('frontend/src/views/Home.vue', "['pdf', 'md', 'txt'].includes(ext)", f"['pdf', 'md', 'txt', {MEDIA}].includes(ext)")
patch('locales/en.json', 'PDF, MD, TXT', 'PDF, MD, TXT, MP3, MP4, M4A, WAV, MOV')
# Transcribing a long video + building the ontology can take longer than MiroFish's 5 minutes
patch('frontend/src/api/index.js', 'timeout: 300000', 'timeout: 900000')
print('MiroFish patched for emet')
