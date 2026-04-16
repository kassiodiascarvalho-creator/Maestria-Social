"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Visão Geral", icon: "◈" },
  { href: "/dashboard/leads", label: "Leads", icon: "◉" },
  { href: "/dashboard/agente", label: "Agente SDR", icon: "◎" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "◷" },
  { href: "/dashboard/emails", label: "Emails", icon: "◈" },
  { href: "/dashboard/dominios", label: "Domínios", icon: "◇" },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: "◎" },
  { href: "/dashboard/integracoes", label: "Integrações", icon: "⬡" },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sideOpen, setSideOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <style>{css}</style>
      <div className="shell">
        {/* Sidebar */}
        <aside className={`sidebar${sideOpen ? " open" : ""}`}>
          <div className="sidebar-logo">
            <span className="sidebar-diamond">◆</span>
            <span className="sidebar-brand">Maestria Social</span>
          </div>

          <nav className="sidebar-nav">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${active ? " active" : ""}`}
                  onClick={() => setSideOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button className="sidebar-logout" onClick={handleLogout}>
            <span>⎋</span> Sair
          </button>
        </aside>

        {/* Overlay mobile */}
        {sideOpen && <div className="overlay" onClick={() => setSideOpen(false)} />}

        {/* Main */}
        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setSideOpen(true)}>☰</button>
            <span className="topbar-title">
              {NAV.find(n => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)))?.label ?? "Dashboard"}
            </span>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </>
  );
}

const css = `
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#0e0f09;color:#fff9e6;font-family:'Inter',system-ui,sans-serif;}
  *::-webkit-scrollbar{width:4px;height:4px;}
  *::-webkit-scrollbar-track{background:transparent;}
  *::-webkit-scrollbar-thumb{background:rgba(194,144,77,.2);border-radius:99px;}
  *::-webkit-scrollbar-thumb:hover{background:rgba(194,144,77,.4);}
  *{scrollbar-width:thin;scrollbar-color:rgba(194,144,77,.2) transparent;}
  .shell{display:flex;min-height:100vh;}
  .sidebar{width:240px;flex-shrink:0;background:#111009;border-right:1px solid #2a1f18;display:flex;flex-direction:column;padding:32px 0;position:sticky;top:0;height:100vh;}
  .sidebar-logo{display:flex;align-items:center;gap:9px;padding:0 24px;margin-bottom:36px;}
  .sidebar-diamond{color:#c2904d;font-size:8px;}
  .sidebar-brand{font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c2904d;}
  .sidebar-nav{display:flex;flex-direction:column;gap:4px;padding:0 12px;flex:1;}
  .nav-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;font-size:14px;font-weight:500;color:#7a6e5e;text-decoration:none;transition:all .15s;letter-spacing:.2px;}
  .nav-item:hover{background:rgba(255,255,255,.04);color:#fff9e6;}
  .nav-item.active{background:rgba(194,144,77,.1);color:#c2904d;border:1px solid rgba(194,144,77,.15);}
  .nav-icon{font-size:12px;width:18px;text-align:center;opacity:.7;}
  .nav-item.active .nav-icon{opacity:1;}
  .sidebar-logout{display:flex;align-items:center;gap:10px;padding:11px 26px;font-size:13px;color:#4a3e30;background:none;border:none;cursor:pointer;font-family:inherit;transition:color .15s;letter-spacing:.3px;}
  .sidebar-logout:hover{color:#7a6e5e;}
  .main{flex:1;display:flex;flex-direction:column;min-width:0;}
  .topbar{display:none;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #2a1f18;background:#111009;}
  .menu-btn{background:none;border:none;color:#7a6e5e;font-size:20px;cursor:pointer;line-height:1;}
  .topbar-title{font-size:15px;font-weight:600;color:#fff9e6;}
  .content{flex:1;overflow-y:auto;background:#0e0f09;}
  .overlay{display:none;}
  @media(max-width:768px){
    .sidebar{position:fixed;left:-240px;top:0;height:100%;z-index:100;transition:left .25s;}
    .sidebar.open{left:0;}
    .topbar{display:flex;}
    .overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;}
  }
`;
