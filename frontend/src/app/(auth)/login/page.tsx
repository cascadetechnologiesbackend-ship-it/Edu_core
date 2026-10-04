import { getActiveTenant } from "@/lib/tenant";
import LoginForm from "./login-form";

export const revalidate = 0; // Disable server caching for login page to ensure dynamic subdomain check works on every hit

export default async function LoginPage() {
  // Gracefully attempt to validate active subdomain tenant
  try {
    await getActiveTenant();
  } catch (err) {
    // If tenant lookup fails (e.g. database not reachable yet or tenant not found),
    // still allow rendering the login page so the app doesn't crash with 500
    console.warn("Could not resolve active tenant on login page:", err);
  }

  return <LoginForm />;
}
