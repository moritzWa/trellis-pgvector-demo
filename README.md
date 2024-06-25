# Trellis PGVector Demo

This project demonstrates the integration of [Trellis](https://usetrellis.co/) for unstructured data to SQL extraction combined with pgvector for vector similarity search in PostgreSQL.

## Introduction

This demo showcases how to:

1. Use Trellis to extract structured data from unstructured email content.
2. Generate vector embeddings for the extracted data using OpenAI's API.
3. Store and query the extracted data and embeddings using PostgreSQL with pgvector extension.

Note: This project is a work in progress. The logic to combine data from the Trellis API with vector embeddings and perform SQL searches across both is still under development.

## Prerequisites

- Docker
- Node.js
- npm

## Setup

### PostgreSQL with [pgvector](https://github.com/pgvector/pgvector)

1. Pull the [pgvector PostgreSQL Docker image](https://hub.docker.com/r/pgvector/pgvector):

   ```
   docker pull pgvector/pgvector:pg16
   ```

2. Start the PostgreSQL container:

   ```
   docker compose up -d
   ```

3. To stop the container (this will wipe the database):
   ```
   docker compose down
   ```

### Server

Run `npm run start` to start the server

## API Endpoints

- `POST /upload-emails`: Upload files located in `./assets` to a Trellis project
- `POST /transform-emails`: Initiate the transformation process for uploaded emails
- `POST /check-upload-status`: Check the status of uploaded assets
- `POST /fetch-transformation-results`: Fetch and save the results of the email transformation
- `POST /embed-emails`: Generate and store embeddings for the emails
- `POST /check-transformation-status`: Check the status of the transformation process
- `GET /emails`: Retrieve all processed emails from the database
- `POST /emails`: Save a new email extraction to the database

## Note on pgvector Installation

If you encounter issues with the pgvector extension, ensure you have the correct Docker image. You may need to manually install the pgvector extension in your PostgreSQL instance. Refer to the pgvector documentation for detailed installation instructions.
