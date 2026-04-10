import type { Metadata, Viewport } from "next";
import BottomNav from "@/components/BottomNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import WidgetSyncBridge from "@/components/WidgetSyncBridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoffeeLog",
  description: "WBrC AI Coffee Brewing Advisor",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/icons/icon-192.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CoffeeLog",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className="bg-dark-page text-text-primary antialiased">
        <ThemeProvider>
          <WidgetSyncBridge />
          <main className="app-safe-area min-h-screen">{children}</main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
