import axios from "axios";
import { Request, Response } from "express";

interface AssetStatus {
  status: string;
}

export class AssetStatusController {
  async checkUploadStatus(request: Request, response: Response) {
    const projectName = request.query.projectName as string;

    if (!projectName) {
      return response.status(400).send("Project name is required");
    }

    const assets_url = `https://api.usetrellis.co/v1/assets/${projectName}`;
    const headers = {
      Authorization: process.env.TRELLIS_API_KEY,
      Accept: "application/json",
    };

    try {
      // Fetch asset IDs for the project
      const assetsResponse = await axios.get(assets_url, { headers });
      const assetIds = assetsResponse.data.data;

      if (assetIds.length === 0) {
        return response.status(404).send("No assets found for the project");
      }

      // Check status for each asset
      const asset_status_url = "https://api.usetrellis.co/v1/assets/status/";
      const statusResponse = await axios.post(
        asset_status_url,
        { ids: assetIds },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      const statuses: Record<string, AssetStatus> = statusResponse.data.data;

      console.log("Asset statuses:", statuses);
      response.json(statuses);
    } catch (error) {
      console.error("Failed to retrieve asset statuses:", error);
      response.status(500).send("Failed to retrieve asset statuses");
    }
  }
}
