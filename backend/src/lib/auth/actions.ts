"use server";
// PUBLIC: NextAuth sign-out — safe without pre-existing session and does not access tenant data

import { signOut } from "@/lib/auth";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
