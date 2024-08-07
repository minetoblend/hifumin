FROM node:22.6-alpine
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apk add --update --no-cache \
    make \
    g++ \
    jpeg-dev \
    cairo-dev \
    giflib-dev \
    pango-dev \
    libtool \
    autoconf \
    automake

WORKDIR /app

COPY package.json /app/
COPY pnpm-lock.yaml /app/

RUN pnpm install

COPY . .

RUN pnpm build

ENTRYPOINT [ "pnpm", "start" ]