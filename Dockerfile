# use small base image
FROM node:13-alpine

# install git as it will be used during server startup
RUN apk update && apk add git

# copy files to container and install dependencies
WORKDIR /app
COPY package*.json server.js ./
RUN ["npm", "install"]

# server will listen on port 3000
EXPOSE 3000

# command for starting the server
ENTRYPOINT ["npm", "start"]
