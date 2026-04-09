import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Coffee Shop Manager
        </h1>
        <p className="text-gray-500 text-base leading-relaxed">
          Theo dõi chi phí nguyên liệu, quản lý sản phẩm, ghi nhận đơn hàng hằng ngày
          và xem báo cáo lợi nhuận — tất cả trong một nơi.
        </p>
      </div>

      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Cách sử dụng
        </h2>
        <ol className="space-y-4">
          {(
            [
              [
                "1",
                "Thêm nguyên liệu",
                "Nhập giá nhập và số lượng nguyên liệu mua vào",
              ],
              [
                "2",
                "Tạo sản phẩm",
                "Tạo thực đơn, thiết lập giá bán và thêm công thức pha chế",
              ],
              [
                "3",
                "Ghi nhận bán hàng",
                "Nhập đơn hàng thời gian thực như một máy tính tiền đơn giản",
              ],
              [
                "4",
                "Xem báo cáo",
                "Xem tổng doanh thu, chi phí và lợi nhuận theo ngày hoặc tháng",
              ],
            ] as const
          ).map(([num, title, desc]) => (
            <li key={num} className="flex items-start gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-800 text-sm font-bold flex items-center justify-center mt-0.5">
                {num}
              </span>
              <div>
                <div className="font-medium text-gray-800">{title}</div>
                <div className="text-sm text-gray-500 mt-0.5">{desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {(
          [
            {
              href: "/ingredients",
              label: "Nguyên liệu",
              desc: "Quản lý nguyên liệu và giá nhập",
              icon: "☕",
            },
            {
              href: "/products",
              label: "Sản phẩm",
              desc: "Quản lý thực đơn, giá bán và công thức",
              icon: "🧾",
            },
            {
              href: "/sales",
              label: "Bán hàng",
              desc: "Nhập đơn hàng nhanh trong ngày",
              icon: "📋",
            },
            {
              href: "/dashboard",
              label: "Báo cáo",
              desc: "Xem doanh thu và lợi nhuận theo ngày/tháng",
              icon: "📊",
            },
          ] as const
        ).map(({ href, label, desc, icon }) => (
          <Link
            key={href}
            href={href}
            className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-amber-400 hover:shadow-sm transition-all group"
          >
            <div className="text-2xl mb-2">{icon}</div>
            <div className="font-semibold text-gray-800 group-hover:text-amber-700 transition-colors">
              {label}
            </div>
            <div className="text-sm text-gray-500 mt-1">{desc}</div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-gray-400 text-center">
        Coffee Shop Manager — MVP v1
      </p>
    </div>
  );
}
