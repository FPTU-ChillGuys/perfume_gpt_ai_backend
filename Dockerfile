FROM node:lts-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

COPY ["package.json", "pnpm-lock.yaml", "./"]

RUN touch host-config.mjs

# Cài full deps để build
RUN pnpm install --frozen-lockfile

COPY . .

RUN npx prisma generate

# Build app
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/src/main.js"]