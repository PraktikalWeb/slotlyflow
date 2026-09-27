"use client";
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface PortalTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
}

export const PortalTooltip = ({ content, children, disabled = false }: PortalTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 12
      });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      
      const resizeObserver = new ResizeObserver(updatePosition);
      if (triggerRef.current) {
        resizeObserver.observe(document.body);
      }
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
        resizeObserver.disconnect();
      };
    }
  }, [isVisible]);

  const show = () => !disabled && setIsVisible(true);
  const hide = () => setIsVisible(false);

  const childElement = children as React.ReactElement<any>;
  const child = React.cloneElement(childElement, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      show();
      childElement.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide();
      childElement.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      show();
      childElement.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hide();
      childElement.props.onBlur?.(e);
    },
  } as React.HTMLAttributes<HTMLElement> & { ref: React.RefObject<HTMLElement | null> });

  if (!mounted || !isVisible || disabled) return child;

  return (
    <>
      {child}
      {createPortal(
        <div 
          className="portal-tooltip"
          style={{ top: position.top, left: position.left, transform: 'translateY(-50%)' }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
};
