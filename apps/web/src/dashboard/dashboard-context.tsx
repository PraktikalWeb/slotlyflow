'use client';

import * as React from 'react';

import {
  activeBusinessMemberships,
  type DashboardBusinessMembership,
  type DashboardUser,
} from './dashboard-types';

interface DashboardContextValue {
  readonly user: DashboardUser;
  readonly memberships: readonly DashboardBusinessMembership[];
  readonly activeMemberships: readonly DashboardBusinessMembership[];
  readonly selectedMembership: DashboardBusinessMembership;
  selectBusiness: (organizationId: string) => void;
  updateBusiness: (organization: DashboardBusinessMembership['organization']) => void;
  updateUser: (user: DashboardUser) => void;
}

const DashboardContext = React.createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({
  children,
  memberships,
  user,
}: Readonly<{
  children: React.ReactNode;
  memberships: readonly DashboardBusinessMembership[];
  user: DashboardUser;
}>): React.JSX.Element {
  const [currentMemberships, setCurrentMemberships] = React.useState(memberships);
  const activeMemberships = React.useMemo(() => activeBusinessMemberships(currentMemberships), [currentMemberships]);
  const [currentUser, setCurrentUser] = React.useState(user);
  const [selectedOrganizationId, setSelectedOrganizationId] = React.useState(activeMemberships[0]?.organization.id);
  const selectedMembership = activeMemberships.find(
    (membership) => membership.organization.id === selectedOrganizationId,
  ) ?? activeMemberships[0];

  if (selectedMembership === undefined) {
    throw new Error('DashboardProvider requires an active Business membership.');
  }

  const value = React.useMemo<DashboardContextValue>(() => ({
    user: currentUser,
    memberships: currentMemberships,
    activeMemberships,
    selectedMembership,
    // This selects presentation context only. Every Business API still authorizes server-side.
    selectBusiness: (organizationId) => {
      if (activeMemberships.some((membership) => membership.organization.id === organizationId)) {
        setSelectedOrganizationId(organizationId);
      }
    },
    updateBusiness: (organization) => {
      setCurrentMemberships((current) => current.map((membership) => (
        membership.organization.id === organization.id
          ? { ...membership, organization }
          : membership
      )));
    },
    updateUser: setCurrentUser,
  }), [activeMemberships, currentMemberships, currentUser, selectedMembership]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext(): DashboardContextValue {
  const context = React.useContext(DashboardContext);
  if (context === undefined) throw new Error('DashboardProvider is required.');
  return context;
}
