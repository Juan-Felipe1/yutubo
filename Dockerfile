FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp + bgutil yt-dlp plugin
# bgutil-ytdlp-pot-provider generates YouTube PO tokens automatically,
# bypassing the IP-based bot detection without requiring user cookies.
RUN pip3 install yt-dlp bgutil-ytdlp-pot-provider --break-system-packages

# Deno (required by yt-dlp for YouTube signature decryption in 2026)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# bgutil PO token HTTP server (listens on port 4416)
RUN git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil && \
    cd /opt/bgutil/server && \
    npm install && \
    npx tsc --skipLibCheck 2>&1 || echo "[bgutil] TypeScript compile done"

# Yutubo backend
WORKDIR /app
COPY backend/ .
RUN npm install --production

# Startup script: launches bgutil server then Yutubo backend
COPY start.sh /start.sh
RUN chmod +x /start.sh

ENV PORT=7860
ENV NODE_ENV=production
# bgutil plugin reads this URL to fetch PO tokens
ENV BGUTIL_HTTP_API=http://localhost:4416
# 90s: enough time for bgutil first-token generation on cold start
ENV ANALYZE_TIMEOUT_MS=90000
EXPOSE 7860

CMD ["/start.sh"]
