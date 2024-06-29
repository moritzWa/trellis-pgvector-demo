import { QueryRunner } from "typeorm/query-runner/QueryRunner";

import { MigrationInterface } from "typeorm";

export class CreateEmailExtractionTable1719502784945
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the table exists
    const tableExists = await queryRunner.hasTable("email_extraction");

    if (tableExists) {
      console.log(
        "email_extraction table already exists, checking embedding column"
      );
      const result = await queryRunner.query(`
        SELECT data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'email_extraction' 
        AND column_name = 'embedding'
      `);

      console.log("Column info:", result[0]);

      if (result.length > 0 && result[0].data_type === "USER-DEFINED") {
        console.log(
          "The 'embedding' column appears to be of type 'vector'. Skipping table creation."
        );
        return;
      }
    }

    await queryRunner.query(`
        CREATE EXTENSION IF NOT EXISTS "vector";
        
        CREATE TABLE IF NOT EXISTS email_extraction (
          id SERIAL PRIMARY KEY,
          ext_file_id TEXT,
          full_email TEXT,
          embedding VECTOR(256),
          ext_file_name TEXT,
          asset_id TEXT,
          result_id TEXT,
          email_from TEXT,
          email_to TEXT[],
          people_mentioned TEXT[],
          compliance_risk BOOLEAN,
          one_line_summary TEXT,
          genre TEXT,
          primary_topics TEXT,
          emotional_tone TEXT,
          date TEXT
        );
      `);

    // Log the table structure
    const tableStructure = await queryRunner.query(`
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'email_extraction';
      `);

    // console.log("Table structure after migration:", tableStructure);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS email_extraction`);
  }
}
