import axios from "axios";
import { Request, Response } from "express";

interface AssetStatus {
  status: string;
}

export class AssetStatusController {
  async checkUploadStatus(request: Request, response: Response) {
    const assetIds = request.query.assetIds as string[];

    const asset_status_url = "https://api.usetrellis.co/v1/assets/status/";
    const headers = {
      Authorization: process.env.TRELLIS_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    let allProcessed = false;

    while (!allProcessed) {
      try {
        const statusResponse = await axios.post(
          asset_status_url,
          { ids: assetIds },
          { headers }
        );
        const statuses: Record<string, AssetStatus> = statusResponse.data.data;
        allProcessed = Object.values(statuses).every(
          (status) =>
            status.status === "processed" || status.status === "not_processed"
        );

        if (!allProcessed) {
          console.log("Not all assets processed. Waiting...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Sleep for 1 second
        } else {
          console.log("All assets processed:", statuses);
          response.json(statuses);
        }
      } catch (error) {
        console.error("Failed to retrieve asset statuses:", error);
        response.status(500).send("Failed to retrieve asset statuses");
        break;
      }
    }
  }
}
