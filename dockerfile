FROM node:20-alpine

WORKDIR /polybot

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run deploy

CMD ["npm", "start"]