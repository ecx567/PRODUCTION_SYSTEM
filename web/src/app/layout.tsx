import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Crop Production System — Dashboard",
  description:
    "Digital agriculture management platform — monitor crops, track sensors, and respond to alerts in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-leaf-50 text-leaf-900 antialiased">
        {children}
      </body>
    </html>
  );
}
