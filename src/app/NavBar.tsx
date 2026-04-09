"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/ingredients", label: "Nguyên liệu" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/sales", label: "Bán hàng" },
  { href: "/dashboard", label: "Báo cáo" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-1 text-sm font-medium">
      <Link
        href="/"
        className="text-amber-700 font-bold hover:text-amber-900 mr-4"
      >
        Coffee Shop Manager
      </Link>
      {links.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1 rounded transition-colors ${
              isActive
                ? "bg-amber-100 text-amber-800 font-semibold"
                : "text-gray-600 hover:text-amber-700 hover:bg-amber-50"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
