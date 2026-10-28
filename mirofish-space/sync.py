"""Keeps MiroFish's saved work (backend/uploads: projects, simulations, reports) in a private Hugging Face dataset,
because a free Space's disk is wiped on every restart. `restore` runs once before MiroFish starts; `watch` pushes
changes every 5 minutes for as long as the Space runs."""
import os
import sys
import time

from huggingface_hub import CommitScheduler, snapshot_download
from huggingface_hub.errors import RepositoryNotFoundError

REPO = os.environ["DATA_REPO"]  # e.g. alvaroibnz/mirofish-data (private dataset)
FOLDER = os.path.expanduser("~/app/backend/uploads")

if sys.argv[1:] == ["restore"]:
    os.makedirs(FOLDER, exist_ok=True)
    try:
        snapshot_download(REPO, repo_type="dataset", local_dir=FOLDER)
    except RepositoryNotFoundError:
        print(f"sync: {REPO} is empty or missing, starting fresh", flush=True)
elif sys.argv[1:] == ["watch"]:
    CommitScheduler(repo_id=REPO, repo_type="dataset", folder_path=FOLDER, every=5, private=True)
    while True:
        time.sleep(3600)
else:
    sys.exit("usage: sync.py restore|watch")
