This is a demo for how to use [Trellis](https://usetrellis.co/) for unstructured data to SQL extraction combined with pgvector.

# Commands

## Docker for running Postgres

1. Start the docker application.
2. Run `docker compose up -d` to start the docker container with the database
3. Run `docker compose down` to stop the container. This will wipe the database.

## Server

Run `npm run start` to start the server

## API

Run `curl -X POST http://localhost:3000/upload-emails` to upload files located in `./assets` to a Trellis project
