import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { EmailExtraction } from "../entity/EmailExtraction";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
const FormData = require("form-data");

export class EmailExtractionController {
  private emailExtractionRepository =
    AppDataSource.getRepository(EmailExtraction);

  async uploadEmailAssets(request: Request, response: Response) {
    const formData = new FormData();
    const directoryPath = path.join(__dirname, "..", "assets");
    const files = fs
      .readdirSync(directoryPath)
      .filter((file) => !file.startsWith("."));

    // Append each file to the form-data
    files.forEach((file) => {
      formData.append(
        "files",
        fs.createReadStream(path.join(directoryPath, file)),
        file
      );
    });

    // Append external IDs (using file names here)
    files.forEach((file) => {
      formData.append("ext_ids", file.replace(".txt", ""));
    });

    // Append external file names
    files.forEach((file) => {
      formData.append("ext_file_names", file);
    });

    formData.append("auth_key", process.env.TRELLIS_API_KEY);
    formData.append("file_types", "txt");
    formData.append("proj_name", "enron_email_extraction");
    // callback todo

    try {
      const res = await axios.post(
        "https://api.usetrellis.co/v1/assets/upload/",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Accept: "application/json",
          },
        }
      );

      response.json(res.data);
    } catch (error) {
      console.error("Failed to upload email assets:", error);
      response.status(500).send("Failed to upload email assets");
    }
  }

  async save(request: Request, response: Response, next: NextFunction) {
    const emailExtraction = this.emailExtractionRepository.create(request.body);
    await this.emailExtractionRepository.save(emailExtraction);
    return response.send(emailExtraction);
  }

  async all(request: Request, response: Response, next: NextFunction) {
    try {
      const allEmails = await AppDataSource.getRepository(
        EmailExtraction
      ).find();
      const cleanEmails = allEmails.map((email) => ({
        id: email.id,
        asset_id: email.asset_id,
        email_from: email.email_from,
        result_id: email.result_id,
        full_email: email.full_email,
        email_to: email.email_to,
        people_mentioned: email.people_mentioned,
        compliance_risk: email.compliance_risk,
        one_line_summary: email.one_line_summary,
        genre: email.genre,
        primary_topics: email.primary_topics,
        emotional_tone: email.emotional_tone,
        date: email.date,
      }));
      response.json(cleanEmails);
    } catch (error) {
      console.error("Error fetching emails:", error);
      response.status(500).send("Error fetching emails");
    }
  }
}
