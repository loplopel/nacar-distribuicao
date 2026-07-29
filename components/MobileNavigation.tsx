'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  Boxes,
  ClipboardList,
  FileSignature,
  FileText,
  Gauge,
  LayoutDashboard,
  LineChart,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  Route,
  ScrollText,
  Settings,
  ShoppingBag,
  Target,
  Users,
  X,
} from 'lucide-react';
import LogoutButton from './LogoutButton';

type Role = 'admin' | 'vendedor' | 'cliente' | string | undefined;

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type Section = {
  title: string;
  items: Item[];
};

function roleLabel(role?: Role) {
  if (role === 'admin') return 'Administrador';
  if (role === 'vendedor') return 'Vendedor';
  return 'Cliente';
}

function sectionsFor(role?: Role): Section[] {
  const sections: Section[] = [];

  if (role === 'admin') {
    sections.push({
      title: 'Painel',
      items: [{ href: '/dashboard', label: 'Visão geral', icon: <LayoutDashboard size={19} /> }],
    });
  } else if (role === 'vendedor') {
    sections.push({
      title: 'Painel',
      items: [{ href: '/vendedor', label: 'Minha área', icon: <Gauge size={19} /> }],
    });
  }

  const commercial: Item[] = [
    { href: '/catalogo', label: 'Catálogo', icon: <ShoppingBag size={19} /> },
    { href: '/pedidos', label: 'Meus pedidos', icon: <ClipboardList size={19} /> },
    { href: '/propostas', label: 'Propostas', icon: <FileSignature size={19} /> },
  ];

  if (role !== 'cliente') {
    commercial.push(
      { href: '/crm', label: 'CRM Comercial', icon: <Target size={19} /> },
      { href: '/inteligencia', label: 'Inteligência', icon: <BrainCircuit size={19} /> },
    );
  }

  if (role === 'vendedor') {
    commercial.push(
      { href: '/rota', label: 'Minha rota', icon: <Route size={19} /> },
      { href: '/clientes', label: 'Meus clientes', icon: <Users size={19} /> },
    );
  }

  sections.push({ title: 'Comercial', items: commercial });

  if (role === 'admin') {
    sections.push(
      {
        title: 'Cadastros',
        items: [
          { href: '/admin/clientes', label: 'Empresas', icon: <Building2 size={19} /> },
          { href: '/admin/usuarios', label: 'Usuários', icon: <Users size={19} /> },
          { href: '/admin/vendedores', label: 'Vendedores', icon: <BriefcaseBusiness size={19} /> },
          { href: '/admin/produtos', label: 'Produtos', icon: <Boxes size={19} /> },
        ],
      },
      {
        title: 'Gestão',
        items: [
          { href: '/admin/pedidos', label: 'Todos os pedidos', icon: <ClipboardList size={19} /> },
          { href: '/admin/metas', label: 'Metas', icon: <BriefcaseBusiness size={19} /> },
          { href: '/admin/gerencial', label: 'Gerencial', icon: <LineChart size={19} /> },
          { href: '/admin/visitas', label: 'Visitas e GPS', icon: <MapPinned size={19} /> },
          { href: '/admin/mapa-comercial', label: 'Mapa comercial', icon: <Route size={19} /> },
          { href: '/admin/whatsapp', label: 'WhatsApp', icon: <MessageCircle size={19} /> },
        ],
      },
      {
        title: 'Sistema',
        items: [
          { href: '/admin/relatorios', label: 'Relatórios', icon: <FileText size={19} /> },
          { href: '/admin/configuracoes', label: 'Configurações', icon: <Settings size={19} /> },
          { href: '/admin/auditoria', label: 'Auditoria', icon: <ScrollText size={19} /> },
        ],
      },
    );
  }

  return sections;
}

export default function MobileNavigation({
  role,
  name,
  initial,
  homeHref,
}: {
  role?: Role;
  name?: string | null;
  initial: string;
  homeHref: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sections = sectionsFor(role);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('mobile-menu-open', open);
    return () => document.body.classList.remove('mobile-menu-open');
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <header className="mobile-top admin-mobile-top mobile-app-header">
        <button
          type="button"
          className="mobile-menu-trigger"
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="mobile-navigation-drawer"
          onClick={() => setOpen(true)}
        >
          <Menu size={23} />
        </button>

        <Link className="mobile-brand" href={homeHref} aria-label="Página inicial">
          <img src="/grupo-nacar.png" alt="Grupo Nacar" />
          <span>Nacar Distribuição</span>
        </Link>

        <div className="mobile-header-avatar" aria-label={name || roleLabel(role)}>{initial}</div>
      </header>

      <div className={`mobile-nav-layer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <button className="mobile-nav-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />
        <aside id="mobile-navigation-drawer" className="mobile-nav-drawer" aria-label="Menu principal">
          <div className="mobile-nav-head">
            <Link href={homeHref} className="mobile-nav-brand" onClick={() => setOpen(false)}>
              <img src="/grupo-nacar-sidebar.png" alt="Grupo Nacar" />
              <span>Nacar Distribuição</span>
            </Link>
            <button type="button" className="mobile-nav-close" aria-label="Fechar menu" onClick={() => setOpen(false)}>
              <X size={22} />
            </button>
          </div>

          <nav className="mobile-nav-content">
            {sections.map((section) => (
              <div className="mobile-nav-section" key={section.title}>
                <div className="mobile-nav-section-title">{section.title}</div>
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={active ? 'active' : ''}
                      onClick={() => setOpen(false)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="mobile-nav-footer">
            <div className="user-avatar">{initial}</div>
            <div className="user-copy">
              <b>{name || 'Usuário'}</b>
              <span>{roleLabel(role)}</span>
            </div>
            <LogoutButton icon={<LogOut size={18} />} />
          </div>
        </aside>
      </div>
    </>
  );
}
