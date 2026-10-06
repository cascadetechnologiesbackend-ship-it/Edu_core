import { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to SchoolMitra ERP — Your school, beautifully organized.",
};

export default function LoginPage() {
  return <LoginForm />;
}
