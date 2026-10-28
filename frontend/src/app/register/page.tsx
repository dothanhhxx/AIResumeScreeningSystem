import { AuthForm, AuthSwitch } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";

export default function RegisterPage() {
  return (
    <AuthLayout mode="register">
      <AuthForm mode="register" />
      <AuthSwitch mode="register" />
    </AuthLayout>
  );
}
