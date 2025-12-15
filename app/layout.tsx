import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { baseMetadata } from "@/lib/metadata";
import { shellClass } from "@/lib/layout";

export const metadata: Metadata = baseMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-slate-100">
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className={`${shellClass} flex-1 flex flex-col py-10 sm:py-12`}>
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
