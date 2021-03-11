FROM node:12.13 AS build
RUN mkdir /tmp/build
WORKDIR /tmp/build

ARG MAPBOX_TOKEN
ENV MAPBOX_TOKEN=${MAPBOX_TOKEN}
ARG DATA_URL
ENV DATA_URL=${DATA_URL}

COPY . /tmp/build

RUN yarn install --production=false && yarn build

FROM nginx
COPY --from=build /tmp/build/dist/ /usr/share/nginx/html/
