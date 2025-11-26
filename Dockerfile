# ---------- Builder stage  ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev for build steps)
COPY package*.json ./
RUN npm ci

# Copy the rest of the source (so build can happen if needed)
COPY . .

# If you use TypeScript run the build, otherwise this step can be no-op
# Keep it safe: run `npm run build` only if "build" exists
RUN if [ -f package.json ] && grep -q "\"build\"" package.json; then npm run build; fi

# ---------- Production image ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# set a default PORT - server.js should honor process.env.PORT
ENV PORT=5000

# Copy only production deps
COPY package*.json ./
RUN npm ci --production

# copy prisma schema & client if you generated it in builder, otherwise copy prisma directory
COPY prisma ./prisma

# copy source (for JS projects) or built output (for TS -> dist)
# If you used a build step and output is in /dist, copy /dist, else copy project files
ARG BUILD_OUTPUT=dist
RUN if [ -d "$BUILD_OUTPUT" ]; then echo "using build output"; else echo "no build output found"; fi

# Prefer copying built dist if present, otherwise copy source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app ./

# Make entrypoint executable
COPY ./docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port and run entrypoint
EXPOSE 5000
ENTRYPOINT [ "sh", "/usr/local/bin/docker-entrypoint.sh" ]
CMD ["npm", "start"]
