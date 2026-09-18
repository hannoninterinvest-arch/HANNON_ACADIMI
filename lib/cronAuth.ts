import { timingSafeEqual } from "node:crypto";
import { getCronSecret } from "@/lib/env";

export function authorizeCron(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header) {
    return false;
  }
  const expected = `Bearer ${getCronSecret()}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
