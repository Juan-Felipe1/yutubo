FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# curl-cffi: Chrome TLS impersonation; bgutil-ytdlp-pot-provider: PO token plugin for yt-dlp
RUN pip3 install -U yt-dlp curl-cffi bgutil-ytdlp-pot-provider --break-system-packages

# bgutil Script Mode — build the Node.js token-generation script and place it at
# ~/bgutil-ytdlp-pot-provider (auto-detected by the yt-dlp plugin, no HTTP server needed).
# Requires Node.js >=20, which is provided by the base image.
RUN curl -fsSL https://github.com/Brainicism/bgutil-ytdlp-pot-provider/archive/refs/tags/1.3.1.tar.gz \
    | tar -xz -C /tmp \
    && cd /tmp/bgutil-ytdlp-pot-provider-1.3.1/server \
    && npm ci \
    && npx tsc \
    && mv /tmp/bgutil-ytdlp-pot-provider-1.3.1/server /root/bgutil-ytdlp-pot-provider \
    && rm -rf /tmp/bgutil-ytdlp-pot-provider-1.3.1

RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

WORKDIR /app
COPY backend/ .
RUN npm install --production

ENV PORT=7860
ENV NODE_ENV=production
ENV ANALYZE_TIMEOUT_MS=90000
EXPOSE 7860

CMD ["node", "server.js"]
