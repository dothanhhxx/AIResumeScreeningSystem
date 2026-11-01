import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthSessionProvider } from "@/lib/auth-session";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentLens | AI Resume Screening",
  description: "A human-centered workspace for reviewing job candidates.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <I18nProvider>
          <AuthSessionProvider>
            <AppShell>{children}</AppShell>
          </AuthSessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
