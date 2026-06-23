FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install yt-dlp --break-system-packages

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
