import "reflect-metadata";
import { DataSource } from "typeorm";
import { EmailExtraction } from "./entity/EmailExtraction";
import { User } from "./entity/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "postgres",
  database: "postgres",
  synchronize: true,
  logging: false,
  entities: [User, EmailExtraction],
  migrations: [],
  subscribers: [],
});
