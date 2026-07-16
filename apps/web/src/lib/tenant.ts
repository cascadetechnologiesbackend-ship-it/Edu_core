import { headers } from "next/headers";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { sql } from "drizzle-orm";
import { notFound } from "next/navigation";

/**
 * Resolves the active tenant school from the request headers' subdomain.
 * Triggers a 404 Not Found if the subdomain is invalid.
 */
export async function getActiveTenant() {
  const host = headers().get("host") || "";
  const parts = host.split(".");
  let tenant = "";

  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    if (parts.length > 1 && parts[0] !== "localhost" && parts[0] !== "127") {
      tenant = parts[0];
    }
  } else if (parts.length > 2) {
    tenant = parts[0];
  }

  // If no subdomain is present, return null (global fallback or master view)
  if (!tenant || tenant === "www") {
    return null;
  }

  const school = await db.query.schools.findFirst({
    where: sql`lower(replace(${schools.name}, ' ', '')) LIKE ${tenant.toLowerCase() + "%"}`,
  });

  if (!school) {
    notFound();
  }

  return school;
}
