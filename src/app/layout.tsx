import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./NavBar";

export const metadata: Metadata = {
  title: "Coffee Shop Manager",
  description: "Quản lý doanh thu và lợi nhuận hằng ngày cho quán cà phê",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 min-h-screen text-gray-900 antialiased">
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
