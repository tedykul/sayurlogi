FROM node:20-alpine
WORKDIR /app

RUN npm install -g bun

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN if [ -d "prisma" ]; then bunx prisma generate; fi

RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
