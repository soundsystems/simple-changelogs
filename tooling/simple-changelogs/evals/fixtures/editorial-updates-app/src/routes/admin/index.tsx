import { requireDeveloper } from "../../session";

export function AdminRoute() {
  requireDeveloper();
  return <main>Developer admin</main>;
}
