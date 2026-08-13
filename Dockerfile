# Stage 1: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and Prisma schemas
COPY . .

# Generate Prisma clients
RUN bunx prisma generate
RUN bunx prisma generate --schema=prisma/zona-parkir/schema.prisma

# Build the application
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Copy package.json and bun.lock
COPY package.json bun.lock ./

# Install only production dependencies
RUN bun install --production --frozen-lockfile

# Copy Prisma schemas
COPY prisma ./prisma

# Generate Prisma clients for production
RUN bunx prisma generate
RUN bunx prisma generate --schema=prisma/zona-parkir/schema.prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port (default 8000 based on .env)
EXPOSE 8000

# Set environment variables (can be overridden by docker-compose)
ENV NODE_ENV=production
ENV PORT=8000

# Start the application
CMD ["bun", "dist/main.js"]
