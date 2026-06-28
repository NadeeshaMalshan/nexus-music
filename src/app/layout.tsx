import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/Providers";
import { DashboardProvider } from "@/context/DashboardContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { DashboardWrapper } from "@/components/echoai/DashboardWrapper";
import { SiteIdentityFooter } from "@/components/SiteIdentityFooter";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Nexus Music | Premium AI Ecosystem",
  description:
    "High-fidelity AI-powered music dashboard blending Spotify intelligence, YouTube playback, and Nexus AI insights.",
  applicationName: "Nexus Music",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    shortcut: "/icons/icon.svg",
    apple: "/brand/nexus-music-logo.svg",
  },
  openGraph: {
    type: "website",
    url: appUrl,
    siteName: "Nexus Music",
    title: "Nexus Music",
    description:
      "AI-powered music dashboard with YouTube playback, personalized recommendations, and social listening.",
    images: [{ url: "/brand/nexus-music-logo.svg", width: 512, height: 512, alt: "Nexus Music logo" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nexus Music",
  },
  formatDetection: {
    telephone: false,
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050505",
};

import { JamProvider } from "@/context/JamContext";
import { DeviceSyncProvider } from "@/context/DeviceSyncContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#050505] text-zinc-100">
        <Providers>
          <SettingsProvider>
            <DeviceSyncProvider>
              <DashboardProvider>
                <JamProvider>
                  <DashboardWrapper>{children}</DashboardWrapper>
                  <SiteIdentityFooter />
                </JamProvider>
              </DashboardProvider>
            </DeviceSyncProvider>
          </SettingsProvider>
        </Providers>
      </body>
    </html>
  );
}
