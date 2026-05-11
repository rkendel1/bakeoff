# syntax=docker/dockerfile:1

FROM node:20-alpine

WORKDIR /app

# Install git so we can clone the tokens extractor repository
RUN apk add --no-cache git

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Clone tokens extractor runtime dependency used by /site-requests endpoint
# Pin to main branch commit 9fbcea4fc76de3baa1cae0a1fcff86f5f61d1d0b that includes dependency installation fix.
RUN git clone https://github.com/rkendel1/tokens.git /opt/tokens \
  && cd /opt/tokens \
  && git checkout 9fbcea4fc76de3baa1cae0a1fcff86f5f61d1d0b \
  && npm ci --omit=dev
ENV TOKENS_CLI_PATH=/opt/tokens/index.js
# tokens uses Playwright; sandbox can be disabled in containerized environments when needed.
ENV TOKENS_NO_SANDBOX=true

# Build (optional but safe if TS compiles)
RUN npm run build

# Expose runtime port
EXPOSE 8080

# Start runtime-core HTTP server
CMD ["npm", "run", "start:prod"]
