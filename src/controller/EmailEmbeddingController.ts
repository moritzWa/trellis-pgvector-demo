import { Request, Response } from "express";
import * as fs from "fs";
import OpenAI from "openai";
import * as path from "path";
import * as pgvector from "pgvector";
import { AppDataSource } from "../data-source";
import { EmailExtraction } from "../entity/EmailExtraction";

export class EmailEmbeddingController {
  async embedEmails(request: Request, response: Response) {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const directoryPath = path.join(__dirname, "..", "assets");
    const files = fs
      .readdirSync(directoryPath)
      .filter((file) => !file.startsWith("."));

    const emailExtractionRepository =
      AppDataSource.getRepository(EmailExtraction);

    for (const file of files) {
      const extId = file.replace(".txt", "");
      const filePath = path.join(directoryPath, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      let vector;

      try {
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-large",
          dimensions: 256,
          input: fileContent,
          encoding_format: "float",
        });

        vector = embedding.data[0].embedding;
      } catch (error) {
        console.error("Failed to generate embedding:", error);
        throw new Error("Failed to generate embedding");
      }

      const emailExtraction = emailExtractionRepository.create({
        ext_file_id: extId,
        ext_file_name: file,
        full_email: fileContent,
        embedding: pgvector.toSql(vector),
      });

      await emailExtractionRepository.save(emailExtraction);
    }

    response.send({ message: "Emails processed and stored successfully." });
  }
}
