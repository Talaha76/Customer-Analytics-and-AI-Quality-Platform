import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppNav from "../components/AppNav";
import Topbar from "../components/Topbar";
import WelcomeModal from "../components/WelcomeModal";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Senvu | Customer Intelligence",
  description: "Customer intelligence and AI evaluation workspace",
};

// Applies the saved theme before first paint so there is no light/dark flash.
const themeScript = `try{var t=localStorage.getItem("senvu-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <div className="app-shell">
          <AppNav />
          <div className="main-shell">
            <Topbar />
            <main className="page-content" id="main">
              {children}
            </main>
          </div>
        </div>

        <WelcomeModal />
      </body>
    </html>
  );
}
