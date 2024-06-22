import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as pgvector from "pgvector";
import { AppDataSource } from "../data-source";
import { EmailExtraction } from "../entity/EmailExtraction";

export class EmailEmbeddingController {
  async embedEmails(request: Request, response: Response) {
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

      // Here, you would typically use an embedding model to create the vector
      // For this example, we'll use a dummy vector
      const dummyVector = [0.1, 0.2, 0.3]; // Replace this with actual embedding

      const emailExtraction = emailExtractionRepository.create({
        ext_file_id: extId,
        ext_file_name: file,
        full_email: fileContent,
        embedding: pgvector.toSql(dummyVector),
      });

      await emailExtractionRepository.save(emailExtraction);
    }

    response.send({ message: "Emails processed and stored successfully." });
  }
}
