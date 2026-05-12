# syntax=docker/dockerfile:1

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    # Chromium core dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    # Additional dependencies for headless browser
    libx11-xcb1 \
    libxcursor1 \
    libgtk-3-0 \
    libpangocairo-1.0-0 \
    libcairo-gobject2 \
    libgdk-pixbuf-2.0-0 \
    fonts-liberation \
    xdg-utils \
    # Clean up to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Clone tokens extractor runtime dependency used by /site-requests endpoint
RUN git clone --branch main --single-branch https://github.com/rkendel1/tokens.git /opt/tokens \
  && cd /opt/tokens \
  && npm ci --omit=dev

# Verify that browsers were installed correctly (optional but recommended)
RUN test -n "$(find /root/.cache/ms-playwright -name 'chrome-headless-shell' -o -name 'chromium' 2>/dev/null | head -1)" || \
    (echo "ERROR: Chromium browser not found!" && \
     echo "Installed browsers:" && \
     ls -la /root/.cache/ms-playwright/ 2>/dev/null || echo "No browsers found" && \
     exit 1)

  
ENV TOKENS_CLI_PATH=/opt/tokens/index.js
# tokens uses Playwright; sandbox can be disabled in containerized environments when needed.
ENV TOKENS_NO_SANDBOX=true

# Build (optional but safe if TS compiles)
RUN npm run build

# Expose runtime port
EXPOSE 8080

# Start runtime-core HTTP server
CMD ["npm", "run", "start:prod"]
