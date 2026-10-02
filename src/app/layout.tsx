import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: { default: "SahiSehat: lab-tested food, matched to your body", template: "%s · SahiSehat" },
  description:
    "Sahi hai? SahiSehat checks Indian packaged food against lab evidence, then tells you whether it fits your own blood sugar, cholesterol and blood pressure numbers, and what to buy instead.",
  applicationName: "SahiSehat",
  appleWebApp: { capable: true, title: "SahiSehat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b6249",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-4">
          {children}
        </main>
        <Footer />
        <RegisterSW />
      </body>
    </html>
  );
}
