"use client";
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface PortalTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
}

type TooltipTriggerProps = React.HTMLAttributes<HTMLElement> & {
  ref?: React.Ref<HTMLElement>;
};

export const PortalTooltip = ({ content, children, disabled = false }: PortalTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Portals intentionally become available only after the client mounts.
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

  const childElement = children as React.ReactElement<TooltipTriggerProps>;
  const child = React.cloneElement(childElement, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      show();
      childElement.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      hide();
      childElement.props.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      show();
      childElement.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      hide();
      childElement.props.onBlur?.(e);
    },
  });

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
