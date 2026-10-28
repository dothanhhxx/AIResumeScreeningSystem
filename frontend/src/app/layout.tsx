import type { Metadata } from "next";
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
    <html lang="en">
      <body>
        <I18nProvider>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
