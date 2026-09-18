import { redirect } from "next/navigation";
import { requireUser, cheminEspace } from "@/lib/auth";

export default async function EspaceIndex() {
  const user = await requireUser();
  redirect(cheminEspace(user.role));
}
