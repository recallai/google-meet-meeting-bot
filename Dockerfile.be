FROM node:18
ARG CACHEBUST=1
WORKDIR /app

# ── config & manifests
COPY tsconfig.base.json ./
COPY package*.json       ./
COPY src/backend/package*.json ./src/backend/
COPY src/backend/tsconfig.json ./src/backend/
COPY src ./src           

# ── deps
RUN npm install \
 && npm install --prefix ./src/backend
COPY src/backend/schema.prisma ./prisma/
RUN npx prisma generate
 
# ── build
RUN echo "🔧  CACHEBUST=$CACHEBUST - running tsc…" \
 && npx tsc --project src/backend/tsconfig.json   \
 && echo "✅  build done; contents of src/dist/backend:" \
 && ls -l src/dist/backend | grep server.js

# ── start
CMD ["node", "src/dist/backend/server.js"]
