import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabLink — Universal Campus Lab Access",
  description:
    "GenAI-powered laboratory resource sharing across ideation, electronics, chemistry, physics, biotech, and advanced research labs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
