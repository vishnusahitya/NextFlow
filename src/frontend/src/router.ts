import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import LoginPage from "./pages/LoginPage";
import WorkflowPage from "./pages/WorkflowPage";

const rootRoute = createRootRoute();

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LoginPage,
});

const workflowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflow/$id",
  component: WorkflowPage,
});

const routeTree = rootRoute.addChildren([loginRoute, workflowRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
