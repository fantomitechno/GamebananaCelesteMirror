FROM node:lts AS build
WORKDIR /app

COPY . .

RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build

FROM node:lts AS run

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json .
COPY --from=build /app/pnpm-lock.yaml .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile -P

CMD node .