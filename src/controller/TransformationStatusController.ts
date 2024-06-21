import axios from "axios";
import { Request, Response } from "express";

interface TransformationStatus {
  status: string;
  statusText: string;
}

export class TransformationStatusController {
  async checkTransformationStatus(request: Request, response: Response) {
    // const transformId = Array.from(statusMap.keys())[0];

    console.log("running checkTransformationStatus");

    const transformId = "transform_2iAyaSagZEYJYi2HOVlo0qBLCeB";

    if (!transformId) {
      response.status(400).send("No transformation ID available in state.");
      return;
    }

    const status_url = "https://api.usetrellis.co/v1/transform/status/";
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: process.env.TRELLIS_API_KEY,
    };
    const data = { ids: [transformId] };

    try {
      let attempts = 0;
      while (true) {
        try {
          const statusResponse = await axios.post(status_url, data, {
            headers,
          });
          const transformationStatus = Object.values(
            statusResponse.data.data
          )[0] as TransformationStatus;
          if (["completed", "failed"].includes(transformationStatus.status)) {
            response.send(transformationStatus);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          if (error.response && error.response.status === 504 && attempts < 3) {
            attempts++;
            console.log(`Attempt ${attempts}: Retrying after timeout...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }
          throw error; // Rethrow the error if it's not a timeout or if retry attempts are exhausted
        }
      }
    } catch (error) {
      console.error("Failed to check transformation status:", error);
      response.status(500).send("Failed to check transformation status");
    }
  }
}
