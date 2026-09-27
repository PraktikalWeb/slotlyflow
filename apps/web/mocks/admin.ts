export const NEEDS_ATTENTION = [
  { id: 1, business: 'Acme Dental', problem: 'WhatsApp connection disconnected', time: '2 hrs ago', severity: 'high', type: 'whatsapp' },
  { id: 2, business: 'Starlight Studio', problem: 'Subscription payment failed', time: '5 hrs ago', severity: 'medium', type: 'billing' },
  { id: 3, business: 'Lumina Spas', problem: 'Repeated webhook delivery failures', time: '12 hrs ago', severity: 'high', type: 'system' },
  { id: 4, business: 'Peak Performance', problem: 'Onboarding incomplete (stalled > 48h)', time: '2 days ago', severity: 'low', type: 'onboarding' },
];

export const RECENT_BUSINESSES = [
  { id: 1, name: 'Nova Fitness', owner: 'Sarah Jenkins', whatsapp: 'connected', sub: 'Pro', joined: 'Today, 09:41' },
  { id: 2, name: 'Peak Performance', owner: 'Mike Ross', whatsapp: 'pending', sub: 'Trial', joined: 'Yesterday, 14:22' },
  { id: 3, name: 'Lumina Spas', owner: 'Emma Watson', whatsapp: 'connected', sub: 'Pro', joined: 'Oct 12, 2023' },
  { id: 4, name: 'Velocity Auto', owner: 'James Smith', whatsapp: 'connected', sub: 'Starter', joined: 'Oct 11, 2023' },
];

export const RECENT_ACTIVITY = [
  { id: 1, text: 'Nova Fitness created a new business account', time: '1 hour ago' },
  { id: 2, text: 'Nova Fitness successfully connected WhatsApp', time: '1 hour ago' },
  { id: 3, text: 'Acme Dental WhatsApp connection dropped', time: '2 hours ago' },
  { id: 4, text: 'Starlight Studio automated payment failed', time: '5 hours ago' },
  { id: 5, text: 'Platform maintenance completed successfully', time: '1 day ago' },
];

export const NOTIFICATIONS = [
  { id: 1, title: 'New business registered', time: '5m ago', unread: true },
  { id: 2, title: 'Platform update completed', time: '2h ago', unread: false },
  { id: 3, title: 'High webhook failure rate', time: '1d ago', unread: false },
];
