# MiroFish (github.com/666ghj/MiroFish, AGPL-3.0) for the emet Marketing → Simulate tool.
# Built from MiroFish's own Dockerfile; the code is cloned untouched at a pinned commit.
FROM python:3.11

RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs npm git \
  && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/

# Hugging Face runs Spaces as user 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH FLASK_DEBUG=False
WORKDIR /home/user

ARG MIROFISH_COMMIT=7657031ac01184afe2cb220f5ee3545573b5e843
RUN git clone https://github.com/666ghj/MiroFish.git app && git -C app checkout "$MIROFISH_COMMIT"

WORKDIR /home/user/app
# Same installs as MiroFish's Dockerfile; the API lives on the same address as the pages ("/")
RUN npm ci \
  && npm ci --prefix frontend \
  && cd backend && uv sync --frozen
# emet's changes (all in patch.py): English by default, audio/video uploads transcribed by media.py
COPY --chown=user media.py backend/app/utils/media.py
COPY --chown=user patch.py /home/user/patch.py
RUN python3 /home/user/patch.py /home/user/app
RUN cd frontend && VITE_API_BASE_URL=/ npm run build
RUN pip install --user --no-cache-dir "huggingface_hub>=0.30,<1"

# ffmpeg pulls the sound out of MP4 / MOV and cuts it into pieces for Whisper
USER root
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
USER user
COPY --chown=user gate.mjs sync.py start.sh /home/user/
EXPOSE 7860
CMD ["sh", "/home/user/start.sh"]
