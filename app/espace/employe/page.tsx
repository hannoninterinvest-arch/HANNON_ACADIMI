import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function EmployeEspace() {
  await requireRole("EMPLOYE");
  redirect("/espace/etudiant");
}
