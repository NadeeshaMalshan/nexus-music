import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/Providers";
import { DashboardProvider } from "@/context/DashboardContext";
import { DashboardWrapper } from "@/components/echoai/DashboardWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EchoAI Music | Premium AI Ecosystem",
  description:
    "High-fidelity AI-powered music dashboard blending Spotify intelligence, YouTube playback, and Llama 3 insights.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EchoAI Music",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#050505] text-zinc-100">
        <Providers>
          <DashboardProvider>
            <DashboardWrapper>{children}</DashboardWrapper>
          </DashboardProvider>
        </Providers>
      </body>
    </html>
  );
}
