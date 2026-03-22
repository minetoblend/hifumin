FROM node:22.6-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest
RUN corepack enable

WORKDIR /app

COPY package.json /app/
COPY pnpm-lock.yaml /app/

RUN pnpm install

COPY . .

RUN pnpm build

ENTRYPOINT [ "pnpm", "start" ]