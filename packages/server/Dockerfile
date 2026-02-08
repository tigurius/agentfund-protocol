# AgentFund API Server Dockerfile

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/sdk/package*.json ./packages/sdk/

# Install dependencies
RUN npm install

# Copy source
COPY packages/sdk ./packages/sdk
COPY packages/server ./packages/server

# Build
RUN npm run build --workspace=@agentfund/sdk
RUN npm run build --workspace=@agentfund/server

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
