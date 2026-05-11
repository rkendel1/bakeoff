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
# Pin to commit used during endpoint integration testing for reproducible builds.
RUN git clone https://github.com/rkendel1/tokens.git /opt/tokens \
  && cd /opt/tokens \
  && git checkout db82b5e6692ec93ef5092d6830b4f75687cabb76
ENV TOKENS_CLI_PATH=/opt/tokens/index.js
# tokens uses Playwright; sandbox can be disabled in containerized environments when needed.
ENV TOKENS_NO_SANDBOX=true

# Build (optional but safe if TS compiles)
RUN npm run build

# Expose runtime port
EXPOSE 8080

# Start runtime-core HTTP server
CMD ["npm", "run", "start:prod"]
