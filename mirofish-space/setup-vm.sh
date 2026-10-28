#!/bin/sh
# One-time setup of the MiroFish server: Ubuntu 24.04 on the free Azure for Students B2ats v2 (1 GB RAM).
# Swap, Docker, the MiroFish container (this folder's Dockerfile) and Caddy for free HTTPS. Safe to run again to update.
# Usage on the VM:  sh ~/mirofish-space/setup-vm.sh <public name, e.g. emet-mirofish.spaincentral.cloudapp.azure.com>
set -eu
HOST="$1"
test -f "$HOME/mirofish.env" || { echo "Missing ~/mirofish.env (the Space secrets, see README.md)"; exit 1; }

# 1 GB RAM: 4 GB swap so the build and the simulations fit
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

sudo apt-get update -q && sudo apt-get install -y -q docker.io caddy
sudo docker build -t mirofish "$HOME/mirofish-space"
mkdir -p "$HOME/uploads"
sudo docker rm -f mirofish 2>/dev/null || true
# Saved work lives on the VM disk (and is copied to the private HF dataset by sync.py)
sudo docker run -d --name mirofish --restart unless-stopped --env-file "$HOME/mirofish.env" \
  -v "$HOME/uploads:/home/user/app/backend/uploads" -p 127.0.0.1:7860:7860 mirofish

printf '%s {\n\treverse_proxy 127.0.0.1:7860\n}\n' "$HOST" | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy
echo "MiroFish: https://$HOST  (health: https://$HOST/healthz)"
