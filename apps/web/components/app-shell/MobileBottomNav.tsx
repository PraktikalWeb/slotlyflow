"use client";
import React from 'react';
import { NavLink } from '../navigation/NavLink';
import { SemanticIcon } from '../../src/icons/semantic-icon';

export const MobileBottomNav = () => {
  return (
    <nav className="mobile-bottom-nav">
      <NavLink 
        href="/dashboard" 
        className="mobile-nav-item" 
        activeClassName="mobile-nav-item--active"
      >
        <SemanticIcon concept="overview" size="control" />
        <span className="text-[10px] font-medium">Home</span>
      </NavLink>
      
      <NavLink 
        href="/dashboard/conversations" 
        className="mobile-nav-item" 
        activeClassName="mobile-nav-item--active"
      >
        <SemanticIcon concept="conversations" size="control" />
        <span className="text-[10px] font-medium">Conversations</span>
      </NavLink>
      
      <NavLink 
        href="/dashboard/automations" 
        className="mobile-nav-item" 
        activeClassName="mobile-nav-item--active"
      >
        <SemanticIcon concept="bot" size="control" />
        <span className="text-[10px] font-medium">Automation</span>
      </NavLink>
    </nav>
  );
};
