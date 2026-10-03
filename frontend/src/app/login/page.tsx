import { AuthForm, AuthSwitch } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";

export default function LoginPage() {
  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title="Sign in to your workspace"
      description="Enter your details to continue to your team dashboard."
    >
      <AuthForm mode="login" />
      <AuthSwitch mode="login" />
    </AuthLayout>
  );
}
