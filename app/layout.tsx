import type { Metadata } from "next";
import "./globals.css";
import { SCRIPT_TEMA } from "@/lib/tema";

export const metadata: Metadata = {
  title: "Iglesia en Montería",
  description: "Sistema contable Iglesia en Montería",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
      data-tema="oscuro"
      suppressHydrationWarning
    >
      <head>
        {/* Aplica el modo claro u oscuro guardado antes de pintar la página */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
