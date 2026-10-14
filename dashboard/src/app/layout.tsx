import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/toast";
import "./globals.css";


// Inter for reading (covers Russian), Space Grotesk for headings and numbers
const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-inter", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-display-face", display: "swap" });

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
      className={`${inter.variable} ${display.variable}`}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
    >
      <head>
        <meta name="theme-color" content={theme === "dark" ? "#07080c" : "#f6f7fb"} />
      </head>
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
