# syntax=docker/dockerfile:1

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build (optional but safe if TS compiles)
RUN npm run build

# Expose runtime port
EXPOSE 8080

# Start runtime-core HTTP server
CMD ["npm", "run", "start:prod"]

