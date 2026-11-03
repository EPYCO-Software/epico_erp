# Una imagen por app: docker build --build-arg APP=erp|portal -t epico-<app> .
FROM node:24-slim AS build
ENV NG_CLI_ANALYTICS=false
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP=portal
RUN npx ng build ${APP}

# nginx sin root, escucha en 8080.
FROM nginxinc/nginx-unprivileged:stable-alpine
ARG APP=portal
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/${APP}/browser /usr/share/nginx/html
EXPOSE 8080
