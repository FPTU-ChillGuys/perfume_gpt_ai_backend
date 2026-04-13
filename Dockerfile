FROM node:lts-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

COPY ["package.json", "pnpm-lock.yaml", "./"]

# Cài full deps để build
RUN pnpm install --frozen-lockfile

COPY . .

RUN npx prisma generate

# Build app
RUN pnpm build

# Sau đó chỉ giữ prod deps
RUN pnpm prune --prod

EXPOSE 3000

CMD ["node", "dist/main.js"]