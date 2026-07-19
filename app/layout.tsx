import type { Metadata } from "next";
import "./globals.css";

const title = "Kranthi — An Interactive Caricature";
const description =
  "A hand-inked caricature of Kranthi—hover, grab, draw through the background, and pull to reveal more.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kranthireddy.com"),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Kranthi — An Interactive Caricature",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
