##############################################
# PRODUCTION DOCKERFILE FOR NODE BACKEND
# No TypeScript / No Next.js / No dist build
##############################################

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

##############################################
# Install dependencies
##############################################
COPY package*.json ./
RUN npm ci --omit=dev

##############################################
# Copy project files (JS backend, no build step)
##############################################
COPY . .

##############################################
# Prisma Client Generation (DATABASE_URL at runtime)
##############################################
RUN npx prisma generate

##############################################
# Expose backend port
##############################################
EXPOSE 5000

##############################################
# Start backend server
##############################################
CMD ["node", "server.js"]
