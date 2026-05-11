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
RUN git clone https://github.com/rkendel1/tokens.git /opt/tokens
ENV TOKENS_CLI_PATH=/opt/tokens/index.js

# Build (optional but safe if TS compiles)
RUN npm run build

# Expose runtime port
EXPOSE 8080

# Start runtime-core HTTP server
CMD ["npm", "run", "start:prod"]
