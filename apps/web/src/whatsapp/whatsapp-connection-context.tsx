'use client';

import * as React from 'react';

import { useDashboardContext } from '@/src/dashboard/dashboard-context';
import {
  getWhatsAppConnection,
  validateWhatsAppConnection,
  type WhatsAppConnection,
  type WhatsAppConnectionReadResult,
} from './whatsapp-client';

export type WhatsAppConnectionState =
  | { readonly status: 'loading'; readonly connection: null }
  | { readonly status: 'ready'; readonly connection: WhatsAppConnection | null }
  | { readonly status: 'unavailable'; readonly connection: null };

type StoredConnectionState = WhatsAppConnectionState & { readonly organizationId: string };

type WhatsAppConnectionContextValue = WhatsAppConnectionState & {
  refresh: () => Promise<WhatsAppConnectionReadResult>;
  validate: () => Promise<WhatsAppConnectionReadResult>;
};

const WhatsAppConnectionContext = React.createContext<WhatsAppConnectionContextValue | undefined>(undefined);

export function WhatsAppConnectionProvider({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const { selectedMembership } = useDashboardContext();
  const organizationId = selectedMembership.organization.id;
  const currentOrganizationId = React.useRef(organizationId);
  const requestSequences = React.useRef(new Map<string, number>());
  const [state, setState] = React.useState<StoredConnectionState>({
    organizationId,
    status: 'loading',
    connection: null,
  });

  React.useEffect(() => {
    currentOrganizationId.current = organizationId;
  }, [organizationId]);

  const load = React.useCallback(async (signal?: AbortSignal): Promise<WhatsAppConnectionReadResult> => {
    const requestedOrganizationId = organizationId;
    const sequence = (requestSequences.current.get(requestedOrganizationId) ?? 0) + 1;
    requestSequences.current.set(requestedOrganizationId, sequence);
    const result = await getWhatsAppConnection(requestedOrganizationId, fetch, undefined, signal);
    if (
      currentOrganizationId.current === requestedOrganizationId
      && requestSequences.current.get(requestedOrganizationId) === sequence
    ) {
      setState(result.ok
        ? { organizationId: requestedOrganizationId, status: 'ready', connection: result.connection }
        : { organizationId: requestedOrganizationId, status: 'unavailable', connection: null });
    }
    return result;
  }, [organizationId]);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setState({ organizationId, status: 'unavailable', connection: null });
      }
    });
    return () => controller.abort();
  }, [load, organizationId]);

  const value = React.useMemo<WhatsAppConnectionContextValue>(() => ({
    ...(state.organizationId === organizationId
      ? state
      : { status: 'loading' as const, connection: null }),
    refresh: () => load(),
    validate: async () => {
      const requestedOrganizationId = organizationId;
      const sequence = (requestSequences.current.get(requestedOrganizationId) ?? 0) + 1;
      requestSequences.current.set(requestedOrganizationId, sequence);
      const result = await validateWhatsAppConnection(requestedOrganizationId);
      if (
        currentOrganizationId.current === requestedOrganizationId
        && requestSequences.current.get(requestedOrganizationId) === sequence
        && result.ok
      ) {
        setState({ organizationId: requestedOrganizationId, status: 'ready', connection: result.connection });
      }
      return result;
    },
  }), [load, organizationId, state]);

  return <WhatsAppConnectionContext.Provider value={value}>{children}</WhatsAppConnectionContext.Provider>;
}

export function useWhatsAppConnection(): WhatsAppConnectionContextValue {
  const context = React.useContext(WhatsAppConnectionContext);
  if (context === undefined) throw new Error('WhatsAppConnectionProvider is required.');
  return context;
}
