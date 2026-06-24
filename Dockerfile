# Railway worker service — builds the whole repo so workers can resolve
# shared code under @/lib/* (tsconfig paths map "@/*" -> repo root).
# The Next.js web app is deployed separately on Vercel; this image only
# runs the background workers via workers/start.ts.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the source (lib/, workers/, tsconfig.json, etc.).
COPY . .

# Health check server in workers/start.ts listens on $PORT (default 8080).
EXPOSE 8080

CMD ["npx", "tsx", "workers/start.ts"]
