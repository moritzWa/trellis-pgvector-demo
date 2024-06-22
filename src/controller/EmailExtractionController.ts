import axios from "axios";
import { NextFunction, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { AppDataSource } from "../data-source";
import { EmailExtraction } from "../entity/EmailExtraction";
import { assetIdMap, transformationStatusMap } from "../state";
import {
  EmailTransformationResult,
  transformationParams,
} from "../tranformations/EmailTranformation";
const FormData = require("form-data");

export class EmailExtractionController {
  private projectName = "file_batches_4";

  private emailExtractionRepository =
    AppDataSource.getRepository(EmailExtraction);

  // upload

  async uploadEmailAssets(request: Request, response: Response) {
    const batchSize = 2;
    const directoryPath = path.join(__dirname, "..", "assets");
    const allFiles = fs
      .readdirSync(directoryPath)
      .filter((file) => !file.startsWith("."));
    let allAssetIds = [];

    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batchFiles = allFiles.slice(i, i + batchSize);
      const formData = new FormData();

      batchFiles.forEach((file) => {
        const extId = file.replace(".txt", "");
        formData.append(
          "files",
          fs.createReadStream(path.join(directoryPath, file))
        );
        formData.append("ext_ids", extId);
        formData.append("ext_file_names", file);
        formData.append("file_types", "txt");
      });

      formData.append("proj_name", this.projectName);

      try {
        const res = await axios.post(
          "https://api.usetrellis.co/v1/assets/upload/",
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              Accept: "application/json",
              Authorization: process.env.TRELLIS_API_KEY,
            },
          }
        );
        const batchAssetIds = Object.keys(res.data.data);
        allAssetIds.push(...batchAssetIds);
        console.log(`Batch ${i / batchSize + 1}: Upload successful`);
      } catch (error) {
        console.error(`Failed to upload batch ${i / batchSize + 1}:`, error);
        response
          .status(500)
          .send(`Failed to upload batch ${i / batchSize + 1}`);
        return;
      }
    }

    const requestId = Date.now().toString();
    assetIdMap.set(requestId, allAssetIds);
    response.send({ message: "All batches uploaded successfully.", requestId });
  }

  // tranform

  async initiateTransformation(request: Request, response: Response) {
    const headers = {
      Authorization: process.env.TRELLIS_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    try {
      const initiateResponse = await axios.post(
        "https://api.usetrellis.co/v1/transform/initiate",
        {
          proj_name: this.projectName,
          transform_params: transformationParams,
        },
        { headers }
      );

      const transformId = initiateResponse.data.data.transform_id;
      transformationStatusMap.set(transformId, { status: "initiated" });

      response.json({
        message: "Transformation initiated",
        data: initiateResponse.data,
      });
    } catch (error) {
      console.error("Error initiating transformation:", error);
      response.status(500).send("Failed to initiate transformation");
    }
  }

  async fetchAndSaveTransformationResults(
    request: Request,
    response: Response
  ) {
    const transformId = transformationStatusMap.keys().next().value; // Get the first transformation ID from the state

    if (!transformId) {
      response.status(400).send("No transformation ID available.");
      return;
    }

    const transformResultsUrl = `https://api.usetrellis.co/v1/transform/${transformId}/results`;
    const headers = {
      Accept: "application/json",
      Authorization: process.env.TRELLIS_API_KEY,
    };

    try {
      const resultsResponse = await axios.get(transformResultsUrl, { headers });
      const results: EmailTransformationResult[] = resultsResponse.data.data;

      // Log the results
      console.log("Transformation Results:", results);

      Object.keys(results).forEach(async (key) => {
        const result = results[key];
        const emailExtraction = this.emailExtractionRepository.create({
          ...result,
          asset_id: key,
          // compliance_risk: result.compliance_risk === "Yes",
        });
        await this.emailExtractionRepository.save(emailExtraction);
      });

      response.send({
        message: "Transformation results fetched and saved successfully.",
      });
    } catch (error) {
      console.error("Failed to fetch transformation results:", error);
      response.status(500).send("Failed to fetch transformation results");
    }
  }

  // get and save emails to db

  async save(request: Request, response: Response, next: NextFunction) {
    console.log("request.body in save", request.body);

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
        ext_file_id: email.ext_file_id,
        ext_file_name: email.ext_file_name,
        embedding: email.embedding,

        // extraction data
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
