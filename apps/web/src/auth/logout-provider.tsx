'use client';

import * as React from 'react';

import { createLogoutSubmitter, type LogoutSubmitter } from './auth-client';

const logoutFailureMessage = "We couldn't log you out. Please try again.";

interface LogoutContextValue {
  readonly error: string | undefined;
  readonly isPending: boolean;
  logout(): Promise<boolean>;
}

const LogoutContext = React.createContext<LogoutContextValue | undefined>(undefined);

interface LogoutProviderProps {
  readonly children: React.ReactNode;
  readonly redirectTo: string;
}

/**
 * Owns one logout submission for an authenticated shell while keeping the
 * backend's opaque-session and CSRF contract in the shared auth client.
 */
export function LogoutProvider({ children, redirectTo }: LogoutProviderProps): React.ReactNode {
  const submitter = React.useRef<LogoutSubmitter | undefined>(undefined);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const logout = React.useCallback(async (): Promise<boolean> => {
    setError(undefined);
    setIsPending(true);

    submitter.current ??= createLogoutSubmitter();
    const result = await submitter.current();
    if (result.ok) {
      // Replacing the history entry avoids returning to a stale authenticated shell.
      window.location.replace(redirectTo);
      return true;
    }

    setIsPending(false);
    setError(logoutFailureMessage);
    return false;
  }, [redirectTo]);

  return (
    <LogoutContext.Provider value={{ error, isPending, logout }}>
      {children}
    </LogoutContext.Provider>
  );
}

export function useLogout(): LogoutContextValue {
  const context = React.useContext(LogoutContext);
  if (context === undefined) {
    throw new Error('useLogout must be used inside a LogoutProvider.');
  }
  return context;
}
