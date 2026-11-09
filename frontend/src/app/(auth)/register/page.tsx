import { AuthLayout } from "@/components/layout/auth-layout";
import { AuthForm, AuthSwitch } from "@/features/auth/auth-form";
import { RegistrationGate } from "@/features/auth/registration-gate";

export default function RegisterPage() {
  return (
    <AuthLayout mode="register">
      <RegistrationGate>
        <AuthForm mode="register" />
      </RegistrationGate>
      <AuthSwitch mode="register" />
    </AuthLayout>
  );
}
