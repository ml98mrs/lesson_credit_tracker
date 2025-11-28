// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import Image from "next/image";

export const metadata = {
  title: "PS English Credit Portal",
  description: "Lesson credits, SNCs, and portals for students, teachers, and admins.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {/* Top bar with logo – shared by all portals */}
        <header className="flex items-center justify-between border-b bg-white px-4 py-2">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-main.png"       // 👈 put your file in /public
              alt="PS English"
              width={140}
              height={40}
              className="h-8 w-auto"
              priority
            />
            {/* Optional: small product label */}
            <span className="text-xs font-medium text-gray-500">
              Credit Portal
            </span>
          </div>

          {/* Optional right side – keep empty for now or add user/profile later */}
          {/* <div className="text-xs text-gray-500">Logged in as …</div> */}
        </header>

        {/* Main app content */}
        <main className="px-4 py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
