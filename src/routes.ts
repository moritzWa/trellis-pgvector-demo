import { AssetStatusController } from "./controller/AssetStatusController";
import { EmailEmbeddingController } from "./controller/EmailEmbeddingController";
import { EmailExtractionController } from "./controller/EmailExtractionController";
import { TransformationStatusController } from "./controller/TransformationStatusController";
import { UserController } from "./controller/UserController";

export const Routes = [
  {
    method: "get",
    route: "/users",
    controller: UserController,
    action: "all",
  },
  {
    method: "get",
    route: "/users/:id",
    controller: UserController,
    action: "one",
  },
  {
    method: "post",
    route: "/users",
    controller: UserController,
    action: "save",
  },
  {
    method: "delete",
    route: "/users/:id",
    controller: UserController,
    action: "remove",
  },
  // trellis
  {
    method: "post",
    route: "/emails",
    controller: EmailExtractionController,
    action: "save",
  },
  {
    method: "get",
    route: "/emails",
    controller: EmailExtractionController,
    action: "all",
  },
  {
    method: "put",
    route: "/upload-emails",
    controller: EmailExtractionController,
    action: "uploadEmailAssets",
  },
  {
    method: "post",
    route: "/transform-emails",
    controller: EmailExtractionController,
    action: "initiateTransformation",
  },
  {
    method: "get",
    route: "/check-upload-status",
    controller: AssetStatusController,
    action: "checkUploadStatus",
  },
  {
    method: "get",
    route: "/fetch-transformation-results",
    controller: EmailExtractionController,
    action: "fetchAndSaveTransformationResults",
  },
  {
    method: "post",
    route: "/search-emails",
    controller: EmailExtractionController,
    action: "search",
  },
  {
    method: "post",
    route: "/seeder",
    controller: EmailExtractionController,
    action: "seed",
  },
  {
    method: "get",
    route: "/check-embedding-type",
    controller: EmailExtractionController,
    action: "checkEmbeddingColumnType",
  },
  // embedding
  {
    method: "post",
    route: "/embed-emails",
    controller: EmailEmbeddingController,
    action: "embedEmails",
  },

  // transformation status
  {
    method: "post",
    route: "/check-transformation-status",
    controller: TransformationStatusController,
    action: "checkTransformationStatus",
  },
];
