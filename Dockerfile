FROM node:20-alpine
WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN if [ -d "prisma" ]; then bunx prisma generate; fi

ENV NEXTAUTH_SECRET="build-time-placeholder-secret-key-32chars"
ENV INTEGRATION_ENCRYPTION_KEY="build-time-placeholder-encryption-key-32"
RUN bun run build

EXPOSE 3000
CMD ["bun", ".next/standalone/server.js"]
