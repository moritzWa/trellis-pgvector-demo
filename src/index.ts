import * as bodyParser from "body-parser";
import * as dotenv from "dotenv";
import * as express from "express";
import { AppDataSource } from "./data-source";
import { Routes } from "./routes";

dotenv.config();

AppDataSource.initialize()
  .then(async () => {
    const app = express();
    app.use(bodyParser.json());

    // Log database connection info
    const dbInfo = await AppDataSource.query(
      "SELECT version(), current_database()"
    );
    console.log("Connected to database:", dbInfo[0]);

    try {
      // Check if pgvector is available
      await AppDataSource.query("SELECT 'vector'::regtype");
      console.log("pgvector is already installed");
    } catch (error) {
      console.log("pgvector is not installed");
      try {
        await AppDataSource.query("CREATE EXTENSION IF NOT EXISTS vector");
        console.log("PG Vector extension enabled successfully.");
      } catch (error) {
        console.error("Error enabling PG Vector extension:", error);
      }
    }

    // Run migrations
    try {
      await AppDataSource.runMigrations();
      console.log("Migrations have been run successfully!");
    } catch (error) {
      console.error("Error running migrations:", error);
      process.exit(1); // Exit the process if migrations fail
    }

    Routes.forEach((route) => {
      app[route.method](route.route, (req, res) => {
        const controller = new (route.controller as any)();
        const result = controller[route.action](req, res);
        if (result instanceof Promise) {
          result
            .then((result) => {
              if (result !== undefined) {
                res.json(result);
              }
            })
            .catch((err) => {
              console.error("Error handling request:", err);
              if (!res.headersSent) {
                // Check if the headers have not been sent yet
                res.status(500).send("An internal server error occurred");
              }
            });
        } else if (result !== undefined) {
          res.json(result);
        }
      });
    });

    app.listen(3000, () => {
      console.log(
        "Express server has started on port 3000. Open http://localhost:3000/emails to see results"
      );
    });
  })
  .catch((error) => {
    console.log("Failed to initialize data source:", error);
  });
