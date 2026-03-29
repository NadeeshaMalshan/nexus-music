import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/Providers";
import { DashboardProvider } from "@/context/DashboardContext";
import { DashboardWrapper } from "@/components/echoai/DashboardWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EchoAI | All-in-one AI Music Ecosystem",
  description:
    "Futuristic AI-powered music dashboard blending Spotify intelligence, YouTube playback, and Llama 3 insights.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
