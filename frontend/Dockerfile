FROM node:20-alpine AS builder

WORKDIR /app

ARG REACT_APP_API_URL
ARG REACT_APP_ML_URL
ARG REACT_APP_SOCKET_URL

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_ML_URL=$REACT_APP_ML_URL
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production nginx image
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html

# React Router support (redirect all to index.html)
RUN echo 'server { \
  listen 80; \
  location / { \
    root /usr/share/nginx/html; \
    index index.html; \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
