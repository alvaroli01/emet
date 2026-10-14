import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/toast";
import "./globals.css";


// Geist: the clean geometric sans of modern dashboards (covers Russian); Geist Mono for small data labels
const geist = Geist({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

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
      className={`${geist.variable} ${geistMono.variable}`}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
    >
      <head>
        <meta name="theme-color" content={theme === "light" ? "#d8d8d3" : "#08080a"} />
      </head>
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
