import { AuthForm, AuthSwitch } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import { RegistrationGate } from "@/components/registration-gate";

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
