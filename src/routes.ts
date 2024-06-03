import { EmailExtractionController } from "./controller/EmailExtractionController";
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
];
