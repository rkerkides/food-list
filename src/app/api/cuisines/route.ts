import { requireUser } from "@/lib/auth/session";
import { listCuisineCatalog } from "@/lib/services/cuisines";

export async function GET() {
  const user = await requireUser();
  return Response.json({ cuisines: await listCuisineCatalog(user.id) });
}
