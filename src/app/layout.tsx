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
  title: "Nexus Music | Professional AI Ecosystem",
  description:
    "High-fidelity AI-powered music dashboard blending Spotify intelligence, YouTube playback, and Llama 3 insights.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
