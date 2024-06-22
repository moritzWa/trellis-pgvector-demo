import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class EmailExtraction {
  // initial vectorization
  @PrimaryGeneratedColumn() // auto generated & incremented
  id: number;

  @Column()
  ext_file_id: string; // ex. 3076 (from 3076.txt)

  // won't receive this from trellis
  @Column("text", { nullable: true })
  full_email: string;

  @Column("text")
  embedding: string; // vector type not supported: https://github.com/typeorm/typeorm/issues/10056

  @Column()
  ext_file_name: string;

  // Trellis extraction
  @Column({ nullable: true })
  asset_id: string;

  @Column({ nullable: true })
  result_id: string;

  @Column({ nullable: true })
  email_from: string;

  @Column("text", { array: true, nullable: true })
  email_to: string[];

  @Column("text", { array: true, nullable: true })
  people_mentioned: string[];

  @Column({ nullable: true })
  compliance_risk: boolean;

  @Column("text", { nullable: true })
  one_line_summary: string;

  @Column({ nullable: true })
  genre: string;

  @Column({ nullable: true })
  primary_topics: string;

  @Column({ nullable: true })
  emotional_tone: string;

  @Column({ nullable: true })
  date: string;
}
