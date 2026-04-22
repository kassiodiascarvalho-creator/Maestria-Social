"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard",             label: "Visão Geral",      icon: "◈" },
  { href: "/dashboard/leads",       label: "Leads",            icon: "◉" },
  { href: "/dashboard/agente",      label: "Agente SDR",       icon: "◎" },
  { href: "/dashboard/followup",    label: "Follow-up",        icon: "◑" },
  { href: "/dashboard/agenda",      label: "Agenda",           icon: "◷" },
  { href: "/dashboard/emails",      label: "Emails",           icon: "◈" },
  { href: "/dashboard/dominios",    label: "Domínios",         icon: "◇" },
  { href: "/dashboard/whatsapp",         label: "WhatsApp Disparo", icon: "◎" },
  { href: "/dashboard/crm",              label: "WhatsApp CRM",     icon: "◉" },
  { href: "/dashboard/pipeline",         label: "Pipeline",         icon: "◧" },
  { href: "/dashboard/whatsapp-numeros", label: "Números WhatsApp",  icon: "◈" },
  { href: "/dashboard/forms",        label: "Formulários",      icon: "◫" },
  { href: "/dashboard/integracoes", label: "Integrações",      icon: "⬡" },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // desktop: true = expanded (240px) | false = collapsed (64px, icon-only)
  // mobile:  true = open (overlay)   | false = hidden
  const [sideOpen, setSideOpen] = useState(true);

  // Começa fechado no mobile
  useEffect(() => {
    if (window.innerWidth <= 768) setSideOpen(false);
  }, []);

  function toggle() { setSideOpen(v => !v); }
  function closeMobile() { if (window.innerWidth <= 768) setSideOpen(false); }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const currentLabel = NAV.find(n =>
    pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href))
  )?.label ?? "Dashboard";

  return (
    <>
      <style>{css}</style>
      <div className="shell">

        {/* ── Sidebar ── */}
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
                  data-label={item.label}
                  title={item.label}
                  onClick={closeMobile}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button className="sidebar-logout" onClick={handleLogout} title="Sair">
            <span className="nav-icon">⎋</span>
            <span className="nav-label">Sair</span>
          </button>
        </aside>

        {/* ── Overlay mobile ── */}
        <div className={`overlay${sideOpen ? " overlay-on" : ""}`} onClick={() => setSideOpen(false)} />

        {/* ── Main ── */}
        <div className="main">
          <header className="topbar">
            {/* Botão animado hamburger ↔ X */}
            <button
              className={`menu-btn${sideOpen ? " menu-open" : ""}`}
              onClick={toggle}
              aria-label={sideOpen ? "Fechar menu" : "Abrir menu"}
            >
              <span className="hb" />
              <span className="hb" />
              <span className="hb" />
            </button>

            <span className="topbar-title">{currentLabel}</span>
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

  /* ── Layout ── */
  .shell{display:flex;min-height:100vh;}
  .main{flex:1;display:flex;flex-direction:column;min-width:0;}
  .content{flex:1;overflow-y:auto;background:#0e0f09;}

  /* ── Topbar (sempre visível) ── */
  .topbar{display:flex;align-items:center;gap:14px;padding:0 20px;height:60px;border-bottom:1px solid #2a1f18;background:#111009;flex-shrink:0;}
  .topbar-title{font-size:14px;font-weight:600;color:#c8b99a;letter-spacing:.2px;}

  /* ── Botão hamburger ── */
  .menu-btn{
    display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;
    width:38px;height:38px;flex-shrink:0;
    background:transparent;border:1px solid transparent;border-radius:9px;cursor:pointer;
    color:#7a6e5e;transition:background .15s,border-color .15s,color .2s;
  }
  .menu-btn:hover{background:rgba(255,255,255,.05);border-color:#2a1f18;color:#c8b99a;}
  .menu-btn.menu-open{color:#c2904d;}

  /* Linhas do hamburger */
  .hb{
    display:block;width:18px;height:1.5px;border-radius:1px;
    background:currentColor;
    transition:transform .32s cubic-bezier(.4,0,.2,1),
               opacity  .22s cubic-bezier(.4,0,.2,1),
               width    .28s cubic-bezier(.4,0,.2,1);
    transform-origin:center;
  }
  /* Estado aberto → X */
  .menu-btn.menu-open .hb:nth-child(1){transform:translateY(6.5px) rotate(45deg);}
  .menu-btn.menu-open .hb:nth-child(2){opacity:0;transform:scaleX(0);}
  .menu-btn.menu-open .hb:nth-child(3){transform:translateY(-6.5px) rotate(-45deg);}

  /* ── Sidebar ── */
  .sidebar{
    width:240px;flex-shrink:0;
    background:#111009;border-right:1px solid #2a1f18;
    display:flex;flex-direction:column;
    padding:28px 0;
    position:sticky;top:0;height:100vh;overflow:hidden;
    transition:width .28s cubic-bezier(.4,0,.2,1);
  }
  /* Desktop colapsado */
  .sidebar:not(.open){width:68px;}

  /* Logo */
  .sidebar-logo{
    display:flex;align-items:center;gap:9px;
    padding:0 22px;margin-bottom:32px;
    overflow:hidden;white-space:nowrap;
  }
  .sidebar-diamond{color:#c2904d;font-size:8px;flex-shrink:0;}
  .sidebar-brand{
    font-size:12px;font-weight:700;letter-spacing:3px;
    text-transform:uppercase;color:#c2904d;
    transition:opacity .2s,max-width .28s;
    max-width:160px;overflow:hidden;
  }
  .sidebar:not(.open) .sidebar-brand{opacity:0;max-width:0;}
  .sidebar:not(.open) .sidebar-logo{padding:0;justify-content:center;}

  /* Nav */
  .sidebar-nav{display:flex;flex-direction:column;gap:3px;padding:0 10px;flex:1;overflow:hidden;}
  .nav-item{
    display:flex;align-items:center;gap:12px;
    padding:10px 12px;border-radius:10px;
    font-size:13.5px;font-weight:500;
    color:#7a6e5e;text-decoration:none;
    transition:background .15s,color .15s,padding .28s,justify-content .28s;
    white-space:nowrap;overflow:hidden;
    position:relative;
  }
  .nav-item:hover{background:rgba(255,255,255,.04);color:#fff9e6;}
  .nav-item.active{background:rgba(194,144,77,.1);color:#c2904d;border:1px solid rgba(194,144,77,.15);}
  .nav-icon{font-size:13px;width:20px;text-align:center;flex-shrink:0;opacity:.75;transition:opacity .15s;}
  .nav-item.active .nav-icon,.nav-item:hover .nav-icon{opacity:1;}
  .nav-label{transition:opacity .18s,max-width .28s;max-width:180px;overflow:hidden;}

  /* Colapsado: centraliza ícone, oculta label, mostra tooltip */
  .sidebar:not(.open) .nav-item{justify-content:center;padding:10px 0;}
  .sidebar:not(.open) .nav-label{opacity:0;max-width:0;}
  .sidebar:not(.open) .sidebar-logout{justify-content:center;padding:10px 0;}

  /* Tooltip CSS no modo colapsado */
  .sidebar:not(.open) .nav-item::after{
    content:attr(data-label);
    position:absolute;left:calc(100% + 10px);top:50%;transform:translateY(-50%);
    background:#1a170f;border:1px solid #2a1f18;
    color:#c8b99a;font-size:12px;padding:5px 10px;border-radius:7px;
    white-space:nowrap;pointer-events:none;
    opacity:0;transition:opacity .15s;z-index:200;
    box-shadow:0 4px 14px #00000060;
    font-family:'Inter',system-ui,sans-serif;font-weight:500;
  }
  .sidebar:not(.open) .nav-item:hover::after{opacity:1;}

  /* Logout */
  .sidebar-logout{
    display:flex;align-items:center;gap:12px;
    padding:10px 22px;
    font-size:13px;color:#4a3e30;
    background:none;border:none;cursor:pointer;font-family:inherit;
    transition:color .15s,padding .28s,justify-content .28s;
    white-space:nowrap;overflow:hidden;
  }
  .sidebar-logout:hover{color:#7a6e5e;}

  /* ── Overlay mobile ── */
  .overlay{
    display:none;position:fixed;inset:0;
    background:rgba(0,0,0,0);
    z-index:99;pointer-events:none;
    transition:background .28s;
  }

  /* ── Mobile ── */
  @media(max-width:768px){
    /* Topbar já visível */
    .sidebar{
      position:fixed !important;
      left:0;top:0;height:100% !important;
      width:240px !important;
      transform:translateX(-100%);
      transition:transform .28s cubic-bezier(.4,0,.2,1) !important;
      z-index:100;
      padding-top:24px;
    }
    .sidebar.open{transform:translateX(0) !important;}
    /* Overlay ativo no mobile */
    .overlay{display:block;}
    .overlay.overlay-on{background:rgba(0,0,0,.55);pointer-events:all;}
    /* Sidebar aberta no mobile: logo e labels normais */
    .sidebar.open .sidebar-brand{opacity:1 !important;max-width:160px !important;}
    .sidebar.open .nav-label{opacity:1 !important;max-width:180px !important;}
    .sidebar.open .sidebar-logo{padding:0 22px !important;justify-content:flex-start !important;}
    .sidebar.open .nav-item{justify-content:flex-start !important;padding:10px 12px !important;}
    .sidebar.open .sidebar-logout{justify-content:flex-start !important;padding:10px 22px !important;}
  }
`;
