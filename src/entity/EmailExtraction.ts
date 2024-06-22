import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class EmailExtraction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  asset_id: string;

  @Column()
  result_id: string;

  @Column()
  ext_file_id: string;

  @Column()
  ext_file_name: string;

  // won't receive this from trellis
  @Column("text", { nullable: true })
  full_email: string;

  @Column()
  email_from: string;

  @Column("text", { array: true })
  email_to: string[];

  @Column("text", { array: true })
  people_mentioned: string[];

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
