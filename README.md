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

Run `npm install` to install the dependencies.

Run `npm run start` to start the server.

# Trellis pg vector Demo Steps

## Setup

1. Upload emails to Trellis

   - Place your email assets in `./assets` (Enron demo data provided)
   - Run:
     ```
     curl -X PUT http://localhost:3000/upload-emails \
     -H "Content-Type: application/json" \
     -d '{
       "projectName": "your_project_name"
     }'
     ```

2. Check the status of the Trellis upload (optional)

   - Run:
     ```
     curl -X GET "http://localhost:3000/check-upload-status?projectName=your_project_name"
     ```

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
     -d '{
       "projectName": "your_project_name"
     }'
     ```
   - Save the returned `transformationId` for future use

5. Check the status of the Trellis transformation (optional)

   - Run:
     ```
     curl -X GET http://localhost:3000/fetch-transformation-results?transformationId=your_transformation_id
     ```
     Replace `your_transformation_id` with the ID from step 4

6. Fetch and save the Trellis transformation results to existing data

   - Run:
     ```
     curl -X GET "http://localhost:3000/fetch-transformation-results?transformationId=your_transformation_id"
     ```

## Search

7. Search for emails using column filter and vector search
   - Run:
     ```
     curl http://localhost:3000/search-emails \
     -H "Content-Type: application/json" \
     -d '{
       "query": "HOW ABOUT SOME ICE CREAM?????",
       "filters": {
         "emotional_tone": "gratitude",
         "compliance_risk": false
       },
       "limit": 3
     }'
     ```
   - This is using L2 distance (Euclidean distance) for vector similarity search
   - Meaning lower `similarity_score` results are more similar

Note: Make sure to replace placeholder IDs with actual IDs returned from the API calls.

# Other API Endpoints

## Seeding Data

To seed the database with sample data:

```
curl -X POST http://localhost:3000/seeder
```

This will insert predefined email data into the database.

## Check Embedding Column Type

To check the data type of the embedding column:

```
curl -X GET http://localhost:3000/check-embedding-type
```

This endpoint is useful for verifying that the embedding column is correctly set up as a vector type.

## Fetch All Emails

To retrieve all emails from the database:

```
curl -X GET http://localhost:3000/emails
```

This will return a JSON array of all email records in the database.

## Save a New Email

To save a new email to the database:

```
curl -X POST http://localhost:3000/emails \
-H "Content-Type: application/json" \
-d '{
  "ext_file_id": "example_id",
  "email_content": "Example email content",
  "email_from": "sender@example.com"
}'
```

Note: Make sure to include all required fields in the JSON payload.

# Note on pgvector Installation

If you encounter issues with the pgvector extension, ensure you have the correct Docker image. You may need to manually install the pgvector extension in your PostgreSQL instance. Refer to the pgvector documentation for detailed installation instructions.
