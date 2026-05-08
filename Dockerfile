FROM node:lts-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

COPY ["package.json", "pnpm-lock.yaml", "./"]

COPY host-config.mjs.example host-config.mjs

# Cài full deps để build
RUN pnpm install --frozen-lockfile

COPY . .

RUN npx prisma generate

# Sync prompts
RUN pnpm run sync:prompts

# Build app
RUN pnpm run build


EXPOSE 3000

CMD ["node", "dist/src/main.js"]