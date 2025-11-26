##############################################
# 1. BUILD STAGE
##############################################
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# -------------------------------------------
# Prisma needs DATABASE_URL here (from GitHub secret)
# -------------------------------------------
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Load the variables for prisma.config.ts
RUN npx prisma generate --schema=./prisma/schema.prisma

RUN npm run build


##############################################
# 2. PRODUCTION STAGE
##############################################
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "start"]
