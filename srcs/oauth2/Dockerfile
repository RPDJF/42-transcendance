FROM node:23.10.0-alpine

RUN apk update
RUN apk upgrade

RUN apk add openssl

WORKDIR /sarif

COPY srcs ./srcs
COPY package.json ./

RUN npm i

RUN openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/ssl/private/sarif.key -out /etc/ssl/certs/sarif.crt -days 365 -subj "/C=CH/ST=Vaud/L=Lausanne/O=42/OU=42/CN=*.42lausanne.ch/UID=SARIF"

COPY docker-entrypoint.sh ./


RUN chmod +x ./docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
