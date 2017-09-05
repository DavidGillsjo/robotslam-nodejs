FROM node:7

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json .
RUN npm install

# Bundle app source
COPY . .

EXPOSE 3000

RUN ["npm", "run", "client:build"]

CMD [ "npm", "start" ]
