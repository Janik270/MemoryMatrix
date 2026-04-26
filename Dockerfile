FROM node:20-alpine

WORKDIR /app

# Ensure native deps build correctly for sqlite3 on alpine
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 80

CMD ["npm", "start"]
