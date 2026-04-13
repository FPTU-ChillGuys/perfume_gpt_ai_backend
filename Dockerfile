FROM node:lts-alpine

# Install pnpm using corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy package files
COPY ["package.json", "pnpm-lock.yaml", "./"]

# Install dependencies (use --frozen-lockfile for consistency)
RUN pnpm install --prod --frozen-lockfile

# Copy the rest of the code
COPY . .

EXPOSE 3000

RUN chown -R node /usr/src/app
USER node

# Use the production start script
CMD ["node", "dist/main.js"]
