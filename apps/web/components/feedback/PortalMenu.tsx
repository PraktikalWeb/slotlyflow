"use client";
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  placement?: 'right-start' | 'bottom-end';
  className?: string;
  children: React.ReactNode;
}

export const PortalMenu = ({
  isOpen,
  onClose,
  triggerRef,
  placement = 'right-start',
  className,
  children,
}: PortalMenuProps) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Portals intentionally become available only after the client mounts.
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (triggerRef.current === null) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 220;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportPadding = 8;
    let top = placement === 'bottom-end' ? rect.bottom + 8 : rect.top;
    let left = placement === 'bottom-end' ? rect.right - menuWidth : rect.right + 12;

    if (top + menuHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - menuHeight - 8);
    }
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuWidth - viewportPadding;
    }

    setPosition({ top, left: Math.max(viewportPadding, left) });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const animationFrame = window.requestAnimationFrame(updatePosition);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, placement, triggerRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className={`portal-menu${className === undefined ? '' : ` ${className}`}`}
      ref={menuRef}
      style={{ top: position.top, left: position.left, zIndex: 110 }}
    >
      {children}
    </div>,
    document.body
  );
};
