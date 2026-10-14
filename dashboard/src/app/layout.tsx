import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

// Onest: a friendly, very readable grotesk drawn for both Latin and Cyrillic (Russian is one of our 7 languages)
const onest = Onest({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-onest", display: "swap" });

export const metadata: Metadata = {
  title: "emet HQ",
  description: "emet team dashboard — €30K revenue / €15K profit by June 2027",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1210" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const theme = (await cookies()).get("emet-theme")?.value;
  return (
    <html
      lang={locale}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      className={onest.variable}
    >
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
