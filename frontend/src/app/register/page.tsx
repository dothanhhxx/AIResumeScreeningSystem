import { AuthForm, AuthSwitch } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";

export default function RegisterPage() {
  return (
    <AuthLayout
      eyebrow="GET STARTED"
      title="Create your workspace account"
      description="Set up your profile to collaborate on thoughtful hiring."
    >
      <AuthForm mode="register" />
      <AuthSwitch mode="register" />
    </AuthLayout>
  );
}
