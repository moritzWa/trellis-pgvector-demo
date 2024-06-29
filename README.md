# Trellis PGVector Demo

This project demonstrates the integration of [Trellis](https://usetrellis.co/) for unstructured data to SQL extraction combined with pgvector for vector similarity search in PostgreSQL.

## Introduction

This demo showcases how to:

1. Use Trellis to extract structured data from unstructured email content.
2. Generate vector embeddings for the extracted data using OpenAI's API.
3. Store and query the extracted data and embeddings using PostgreSQL with pgvector extension.

Note: This project is a work in progress. The logic to combine data from the Trellis API with vector embeddings and perform SQL searches across both is still under development.

# Setup

## Prerequisites

- Docker
- Node.js
- npm

## PostgreSQL with [pgvector](https://github.com/pgvector/pgvector)

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

## Environment

Create a `.env` file with the following:

```
TRELLIS_API_KEY=your_trellis_api_key
OPENAI_API_KEY=your_openai_api_key
```

You can get a Trellis API key [here](https://usetrellis.co).

## Server

Run `npm run start` to start the server

# Trellis pg vector Demo Steps

## Setup

1. Upload emails to Trellis

   - Place your email assets in `./assets` (Enron demo data provided)
   - Run:
     ```
     curl -X PUT http://localhost:3000/upload-emails
     ```
   - Save the returned `assetIds` array for future use

2. Check the status of the Trellis upload (optional)

   - Run:
     ```
     curl -X GET "http://localhost:3000/check-upload-status?assetIds=id1,id2,id3"
     ```
   - Replace `id1,id2,id3` with the actual asset IDs returned from step 1

## Embedding and Trellis Tranformation

3. Embed the emails and store them in the DB

   - Run:
     ```
     curl -X POST http://localhost:3000/embed-emails
     ```

4. Initiate the Trellis transformation process

   - Run:
     ```
     curl -X POST http://localhost:3000/transform-emails \
     -H "Content-Type: application/json" \
     -d '{"assetIds": ["id1", "id2", "id3"]}'
     ```
   - Save the returned `transformationId` for future use

5. Check the status of the Trellis transformation (optional)

   - Run:
     ```
     curl -X GET http://localhost:3000/fetch-transformation-results?transformationId=your_transformation_id
     ```
     Replace `your_transformation_id` with the ID from step 3

6. Fetch and save the Trellis transformation results to existing data

   - Run:
     ```
     curl -X GET "http://localhost:3000/fetch-transformation-results?transformationId=your_transformation_id"
     ```

## Search

7. Search for emails using column filter and vector search
   - Run:
     ```
     curl -X POST http://localhost:3000/search-emails \
     -H "Content-Type: application/json" \
     -d '{
       "query": "authorities restricting business activity",
       "filters": {
         "emotional_tone": "neutral",
         "compliance_risk": true
       },
       "limit": 3
     }'
     ```

Note: Make sure to replace placeholder IDs with actual IDs returned from the API calls.

# Other API Endpoints

<!-- todo -->

# Note on pgvector Installation

If you encounter issues with the pgvector extension, ensure you have the correct Docker image. You may need to manually install the pgvector extension in your PostgreSQL instance. Refer to the pgvector documentation for detailed installation instructions.
