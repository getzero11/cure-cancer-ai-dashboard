import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Cure Cancer With AI / Observatory",
  description:
    "A periodically refreshed oncology signal board for research, approvals, news and clinical trials.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
