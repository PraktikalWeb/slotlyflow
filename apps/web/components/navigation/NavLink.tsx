"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  activeClassName?: string;
}

export const NavLink = ({ href, children, className = "", activeClassName = "" }: NavLinkProps) => {
  const pathname = usePathname();
  // Exact match for dashboard root, otherwise startsWith for subroutes
  const isActive = href === "/dashboard" 
    ? pathname === "/dashboard" 
    : pathname.startsWith(href);

  return (
    <Link 
      href={href} 
      className={`${className} ${isActive ? activeClassName : ""}`.trim()}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
};
