import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { baseMetadata, DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/metadata";
import { shellClass } from "@/lib/layout";

export const metadata: Metadata = baseMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: "Bad Joke Lab",
      url: SITE_URL,
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background text-slate-100">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-0D84H0D66W"
          strategy="afterInteractive"
        />
        <Script id="ga4-gtag" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-0D84H0D66W');`}
        </Script>
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
