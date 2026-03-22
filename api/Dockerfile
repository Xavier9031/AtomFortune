FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS dev
RUN npm ci
COPY . .

FROM base AS prod
COPY --from=base /app/node_modules ./node_modules
COPY dist ./dist
CMD ["node", "dist/index.js"]
