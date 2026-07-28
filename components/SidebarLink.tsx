'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function SidebarLink({ href, icon, children, exact = false }:{ href:string; icon:ReactNode; children:ReactNode; exact?:boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} className={active ? 'active' : ''}>{icon}<span>{children}</span></Link>;
}
