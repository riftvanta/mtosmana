import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthDebug from "@/components/AuthDebug";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Financial Transfer Management System",
  description: "Mobile-first PWA for financial transfer management between exchange offices and admin",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Transfer System",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3B82F6',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <AuthDebug />
        </AuthProvider>
      </body>
    </html>
  );
}
