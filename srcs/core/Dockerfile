FROM node:24.4.0-alpine

RUN apk update
RUN apk upgrade
RUN apk add curl openssl

WORKDIR /sarif

COPY package.json /sarif
RUN npm i

COPY srcs/ ./srcs

# EXPOSE 80
EXPOSE 443

COPY ./docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
