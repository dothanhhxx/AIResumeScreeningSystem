import { AuthLayout } from "@/components/layout/auth-layout";
import { AuthForm, AuthSwitch } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <AuthLayout mode="login">
      <AuthForm mode="login" />
      <AuthSwitch mode="login" />
    </AuthLayout>
  );
}
