import type { Metadata } from "next";
import { Oswald, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { banner, images } from "@/content/site";
import Sidebar from "@/components/Sidebar";
import { SpeedInsights } from "@vercel/speed-insights/next";

const oswald = Oswald({ variable: "--font-heading", subsets: ["latin"] });
const sourceSans = Source_Sans_3({ variable: "--font-body", subsets: ["latin"] });

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Sixth Avenue West HOA",
  description: "A wonderful place to live in Golden, Colorado",
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/documents", label: "Documents" },
  { href: "/faq", label: "FAQ" },
  { href: "/buying-selling", label: "Buying/Selling" },
  { href: "/newsletters", label: "Newsletters" },
  { href: "/events", label: "Events" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${oswald.variable} ${sourceSans.variable}`}>
      <body>
        {banner.show && (
          <div className="banner" role="status">
            <span>{banner.text}</span>{" "}
            {banner.href && <Link href={banner.href}>{banner.linkText}</Link>}
          </div>
        )}
        <header
          className="masthead"
          style={{ backgroundImage: `url(${images.header})` }}
        >
          <div className="masthead-inner">
            <Link href="/" className="site-title">
              Sixth Avenue West HOA
            </Link>
            <p className="tagline">A wonderful place to live in Golden, Colorado</p>
          </div>
        </header>
        <nav className="nav" aria-label="Main">
          <div className="nav-inner">
            <ul>
              {nav.map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
            <Link href="/pay-dues" className="button nav-cta">
              Pay Dues
            </Link>
          </div>
        </nav>
        <div className="page">
          <main className="content">{children}</main>
          <Sidebar />
        </div>
        <footer className="footer">
          <p>Sixth Avenue West Homeowners&rsquo; Association · P.O. Box 18111, Golden, CO 80402-6035</p>
          <p className="proto">Prototype for comparison. Sample content is marked SAMPLE.</p>
        </footer>
        <SpeedInsights />
      </body>
    </html>
  );
}
