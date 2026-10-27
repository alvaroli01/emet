import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ToastProvider } from "@/components/toast";
import "./globals.css";


// Geist: the clean geometric sans of modern dashboards (covers Russian); Geist Mono for small data labels
const geist = Geist({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "emet HQ",
  description: "emet team dashboard — €30K revenue / €15K profit by June 2027",
  // Opens full-screen from the iPhone home screen (needed there for phone notifications)
  appleWebApp: { capable: true, title: "emet", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08080a",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geist.variable} ${geistMono.variable}`}
      // Dark only: the light theme was removed (2026-10-15), so an old "emet-theme" cookie is ignored
      data-theme="dark"
    >
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
