import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "emet HQ",
  description: "emet team dashboard — €30K revenue / €15K profit by June 2027",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const theme = (await cookies()).get("emet-theme")?.value;
  return (
    <html
      lang={locale}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
