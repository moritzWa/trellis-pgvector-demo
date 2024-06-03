import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class EmailExtraction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  asset_id: string;

  @Column()
  result_id: string;

  @Column("text")
  full_email: string;

  @Column()
  email_from: string;

  @Column()
  email_to: string;

  @Column("text")
  people_mentioned: string;

  @Column()
  compliance_risk: boolean;

  @Column("text")
  one_line_summary: string;

  @Column()
  genre: string;

  @Column()
  primary_topics: string;

  @Column()
  emotional_tone: string;

  @Column()
  date: string;
}
