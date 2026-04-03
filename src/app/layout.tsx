import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/Providers";
import { DashboardProvider } from "@/context/DashboardContext";
import { DashboardWrapper } from "@/components/echoai/DashboardWrapper";



export const metadata: Metadata = {
  title: "Nexus | Premium AI Ecosystem",
  description:
    "High-fidelity AI-powered music dashboard blending Spotify intelligence, YouTube playback, and Echo AI insights.",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nexus",
  },
  formatDetection: {
    telephone: false,
  },
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
          <DashboardProvider>
            <JamProvider>
              <DashboardWrapper>{children}</DashboardWrapper>
            </JamProvider>
          </DashboardProvider>
        </Providers>
      </body>
    </html>
  );
}
