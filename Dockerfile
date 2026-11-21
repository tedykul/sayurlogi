FROM oven/bun:1
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN if [ -d "prisma" ]; then bunx prisma generate; fi

RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
