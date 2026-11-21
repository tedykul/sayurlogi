FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN if [ -d "prisma" ]; then npx prisma generate; fi

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
