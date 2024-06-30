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

    const emailExtractions: EmailExtraction[] = [];

    console.log(`Found ${files.length} files to process.`);

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      console.log(`Processing file ${index + 1} of ${files.length}: ${file}`);
      const extId = file.replace(".txt", "");
      const filePath = path.join(directoryPath, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      // Extract email content
      const emailContent = this.extractEmailContent(fileContent);

      let vector;

      try {
        const embedding = await openai.embeddings.create({
          model: "text-embedding-3-large",
          dimensions: 256,
          input: emailContent,
          encoding_format: "float",
        });

        vector = embedding.data[0].embedding;
      } catch (error) {
        console.error(`Failed to generate embedding for file ${file}:`, error);
        continue; // Skip this file and continue with the next one
      }

      emailExtractions.push(
        emailExtractionRepository.create({
          ext_file_id: extId,
          ext_file_name: file,
          email_content: emailContent,
          embedding: pgvector.toSql(vector),
        })
      );
    }

    console.log("Performing bulk upsert...");
    await emailExtractionRepository.upsert(emailExtractions, ["ext_file_id"]);
    console.log("Bulk upsert completed.");

    response.send({ message: "Emails processed and stored successfully." });
  }

  private extractEmailContent(fullEmail: string): string {
    // Regex to match everything after the last occurrence of "X-FileName:"
    const contentRegex = /X-FileName:.*?\n([\s\S]*)/;
    const match = fullEmail.match(contentRegex);

    if (match && match[1]) {
      // Trim leading and trailing whitespace
      return match[1].trim();
    }

    // If no match found, return the original content
    return fullEmail;
  }
}
