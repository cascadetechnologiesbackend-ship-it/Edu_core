import { getActiveTenant } from "@/lib/tenant";
import LoginForm from "./login-form";

export const revalidate = 0; // Disable server caching for login page to ensure dynamic subdomain check works on every hit

export default async function LoginPage() {
  // Validate active subdomain tenant
  await getActiveTenant();

  return <LoginForm />;
}
