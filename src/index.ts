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

    try {
      await AppDataSource.query("CREATE EXTENSION IF NOT EXISTS vector");
      console.log("PG Vector extension enabled successfully.");
    } catch (error) {
      console.error("Error enabling PG Vector extension:", error);
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
