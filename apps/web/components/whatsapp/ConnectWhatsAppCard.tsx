'use client';

import * as React from 'react';
import Image from 'next/image';

import { SemanticIcon } from '@/src/icons/semantic-icon';
import whatsappBusinessAppIcon from '../../public/brand/whatsapp-business-app.jpg';

/**
 * ConnectWhatsAppCard — the single authoritative "Connect WhatsApp" card.
 *
 * Used on every customer page where the Business must connect WhatsApp before
 * proceeding. Accepts an `onConnect` callback for the primary CTA so that:
 *   - The WhatsApp page passes the real onboarding handler.
 *   - Other pages (Dashboard, Automation) pass a navigation handler to
 *     /dashboard/whatsapp, preserving a single Meta Embedded Signup surface.
 */
export interface ConnectWhatsAppCardProps {
  /** Invoked when the primary CTA is activated. */
  readonly onConnect: () => void;
  /** When true the CTA is disabled and shows in-progress copy. */
  readonly isConnecting?: boolean;
  /** Readiness is established before Meta can be opened from the CTA click. */
  readonly connectionPreparation?: 'preparing' | 'connecting' | 'ready';
  /** When false (e.g. AGENT role) the CTA is hidden. Defaults to true. */
  readonly canConnect?: boolean;
}

export function ConnectWhatsAppCard({
  onConnect,
  isConnecting = false,
  connectionPreparation,
  canConnect = true,
}: ConnectWhatsAppCardProps): React.JSX.Element {
  const preparation = connectionPreparation ?? (isConnecting ? 'connecting' : 'ready');
  return (
    <div className="mx-auto w-full max-w-[500px]">
      <section
        aria-label="Connect WhatsApp"
        className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-sm"
      >
        {/* ── Connection graphic ── */}
        <style>{`
          @keyframes slotlyConnectionFlow {
            to { stroke-dashoffset: -20; }
          }
        `}</style>

        {/* Compact icon group — intrinsic width, centered */}
        <div className="mb-7 inline-flex items-center gap-0">
          {/* SlotlyFlow icon — no container, no background */}
          <img
            src="/green_icon.png"
            alt="SlotlyFlow"
            className="h-14 w-14 shrink-0 object-contain"
          />

          {/* Animated dashed connection line — fixed compact width */}
          <div
            className="w-[110px] shrink-0 sm:w-[120px]"
            aria-hidden="true"
          >
            <svg
              className="w-full text-[var(--ink-tertiary)]"
              height="24"
              viewBox="0 0 100 24"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line
                x1="0"
                y1="12"
                x2="100"
                y2="12"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="animate-[slotlyConnectionFlow_1s_linear_infinite] motion-reduce:animate-none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* WhatsApp icon — rounded-square container unchanged */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-subtle)] shadow-sm">
            <Image
              src={whatsappBusinessAppIcon}
              alt="WhatsApp Business"
              className="h-10 w-10 rounded-[10px] object-cover"
            />
          </div>
        </div>

        {/* ── Heading & description ── */}
        <h2 className="text-[26px] font-semibold tracking-tight text-[var(--ink)]">
          Connect your WhatsApp
        </h2>
        <p className="mt-2 max-w-[460px] text-[15px] leading-relaxed text-[var(--ink-secondary)]">
          Connect your Business WhatsApp number to start using SlotlyFlow automation.
        </p>

        {/* ── Reassurance panel ── */}
        <div className="mt-6 flex w-full max-w-[520px] items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] px-4 py-3 text-left">
          <div className="relative mt-0.5 shrink-0">
            <Image
              src={whatsappBusinessAppIcon}
              alt=""
              aria-hidden="true"
              className="h-8 w-8 rounded-[6px] object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white"
            >
              <SemanticIcon concept="check" className="!text-[8px]" size="metadata" />
            </span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--ink)]">Existing WhatsApp Business App</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-secondary)]">
              Keep using your current WhatsApp Business App while SlotlyFlow handles your automation.
            </p>
          </div>
        </div>

        {/* ── Primary CTA ── */}
        <div className="mt-5 w-full max-w-[520px]">
          {canConnect ? (
            <button
              className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] bg-[#25D366] px-6 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#20BD5A] disabled:cursor-not-allowed disabled:opacity-65"
              disabled={preparation !== 'ready'}
              onClick={onConnect}
              type="button"
            >
              <SemanticIcon
                concept="whatsappConnection"
                className="!h-[18px] !w-[18px] !text-[18px] opacity-90"
              />
              <span>
                {preparation === 'preparing'
                  ? 'Preparing connection…'
                  : preparation === 'connecting'
                    ? 'Connecting…'
                    : 'Connect WhatsApp Business App'}
              </span>
              <Image
                src={whatsappBusinessAppIcon}
                alt=""
                aria-hidden="true"
                className="h-[22px] w-[22px] rounded-[4px] object-cover opacity-90"
              />
            </button>
          ) : (
            <p className="text-[13px] text-[var(--ink-secondary)]">
              A Business Owner or Admin must connect WhatsApp.
            </p>
          )}
        </div>

        {/* ── Meta explanation ── */}
        <p className="mt-4 max-w-[460px] text-[12px] leading-relaxed text-[var(--ink-tertiary)]">
          You'll briefly continue with Meta to choose the WhatsApp Business account and number you want to use.
        </p>
      </section>
    </div>
  );
}
