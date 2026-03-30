import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorScope — Find Authentic YouTube Creators",
  description:
    "AI-powered discovery of trustworthy YouTube creators based on your interests and location.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
