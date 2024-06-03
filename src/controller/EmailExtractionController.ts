import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { EmailExtraction } from "../entity/EmailExtraction";

export class EmailExtractionController {
  private emailExtractionRepository =
    AppDataSource.getRepository(EmailExtraction);

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
