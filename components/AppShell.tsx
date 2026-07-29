import Link from 'next/link';
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageCircle,
  Settings,
  ScrollText,
  ShoppingBag,
  Target,
  Users,
  BriefcaseBusiness,
  FileSignature,
  BrainCircuit,
  MapPinned,
  Route,
} from 'lucide-react';
import LogoutButton from './LogoutButton';
import SidebarLink from './SidebarLink';
import MobileNavigation from './MobileNavigation';
import { getCurrentProfile } from '@/lib/supabase-server';

function roleLabel(role?: string) {
  if (role === 'admin') return 'Administrador';
  if (role === 'vendedor') return 'Vendedor';
  return 'Cliente';
}

export default async function AppShell({children}:{children:React.ReactNode}){
  const p=await getCurrentProfile();
  const initial=(p?.name || 'N').trim().charAt(0).toUpperCase();

  return <div className="shell admin-shell">
    <aside className="sidebar admin-sidebar">
      <Link className="group-brand" href={p?.role==='admin'?'/dashboard':p?.role==='vendedor'?'/vendedor':'/catalogo'}>
        <img src="/grupo-nacar-sidebar.png" alt="Grupo Nacar" />
        <span>Distribuição B2B</span>
      </Link>

      <nav className="side-nav admin-nav">
        {p?.role==='admin'&&<>
          <div className="nav-section-title">PAINEL</div>
          <SidebarLink href="/dashboard" icon={<LayoutDashboard size={19}/>}>Visão geral</SidebarLink>
        </>}
        {p?.role==='vendedor'&&<>
          <div className="nav-section-title">PAINEL</div>
          <SidebarLink href="/vendedor" icon={<Gauge size={19}/>}>Minha área</SidebarLink>
        </>}

        <div className="nav-section-title">COMERCIAL</div>
        <SidebarLink href="/catalogo" icon={<ShoppingBag size={19}/>}>Catálogo</SidebarLink>
        <SidebarLink href="/pedidos" icon={<ClipboardList size={19}/>}>Meus pedidos</SidebarLink>
        <SidebarLink href="/propostas" icon={<FileSignature size={19}/>}>Propostas</SidebarLink>
        {p?.role!=='cliente'&&<><SidebarLink href="/crm" icon={<Target size={19}/>}>CRM Comercial</SidebarLink><SidebarLink href="/inteligencia" icon={<BrainCircuit size={19}/>}>Inteligência</SidebarLink></>}
        {p?.role==='vendedor'&&<><SidebarLink href="/rota" icon={<Route size={19}/>}>Minha rota</SidebarLink><SidebarLink href="/clientes" icon={<Users size={19}/>}>Meus clientes</SidebarLink></>}

        {p?.role==='admin'&&<>
          <div className="nav-section-title">CADASTROS</div>
          <SidebarLink href="/admin/clientes" icon={<Building2 size={19}/>}>Empresas</SidebarLink>
          <SidebarLink href="/admin/usuarios" icon={<Users size={19}/>}>Usuários</SidebarLink>
          <SidebarLink href="/admin/vendedores" icon={<BriefcaseBusiness size={19}/>}>Vendedores</SidebarLink>
          <SidebarLink href="/admin/produtos" icon={<Boxes size={19}/>}>Produtos</SidebarLink>

          <div className="nav-section-title">GESTÃO</div>
          <SidebarLink href="/admin/pedidos" icon={<ClipboardList size={19}/>}>Todos os pedidos</SidebarLink>
          <SidebarLink href="/admin/metas" icon={<BriefcaseBusiness size={19}/>}>Metas</SidebarLink>
          <SidebarLink href="/admin/gerencial" icon={<LineChart size={19}/>}>Gerencial</SidebarLink>
          <SidebarLink href="/admin/visitas" icon={<MapPinned size={19}/>}>Visitas e GPS</SidebarLink>
          <SidebarLink href="/admin/mapa-comercial" icon={<Route size={19}/>}>Mapa comercial</SidebarLink>
          <SidebarLink href="/admin/whatsapp" icon={<MessageCircle size={19}/>}>WhatsApp</SidebarLink>

          <div className="nav-section-title">SISTEMA</div>
          <SidebarLink href="/admin/relatorios" icon={<FileText size={19}/>}>Relatórios</SidebarLink>
          <SidebarLink href="/admin/configuracoes" icon={<Settings size={19}/>}>Configurações</SidebarLink>
          <SidebarLink href="/admin/auditoria" icon={<ScrollText size={19}/>}>Auditoria</SidebarLink>
        </>}
      </nav>

      <div className="sidebar-footer admin-sidebar-footer">
        <div className="user-avatar">{initial}</div>
        <div className="user-copy"><b>{p?.name}</b><span>{roleLabel(p?.role)}</span></div>
        <LogoutButton icon={<LogOut size={18}/>} />
      </div>
    </aside>

    <main className="main admin-main">
      <MobileNavigation
        role={p?.role}
        name={p?.name}
        initial={initial}
        homeHref={p?.role==='admin'?'/dashboard':p?.role==='vendedor'?'/vendedor':'/catalogo'}
      />
      <div className="container admin-container">{children}</div>
    </main>
  </div>
}
