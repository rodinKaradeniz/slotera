export type WorkingDay = {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
};

export type ConnectionStatus = "connected" | "disconnected";

export type PaymentMethod = "card" | "paypal" | "manual";

export type Connection = {
  id: string;
  label: string;
  detail: string;
  status: ConnectionStatus;
};

export type SettingsData = {
  business: {
    name: string;
    displayName: string;
    bio: string;
    email: string;
    phone: string;
    address: string;
    bookingPageUrl: string;
  };
  branding: {
    accent: string;
    fontFamily: "serif" | "sans";
    heroImage?: string;
  };
  payments: {
    processors: Connection[];
    taxRate: number;
    vatNumber: string;
    manualPaymentEnabled: boolean;
    manualPaymentInstructions: string;
    defaultPaymentMethods: PaymentMethod[];
  };
  calendar: {
    connections: Connection[];
    workingHours: WorkingDay[];
    defaultMeetingProvider: "zoom" | "meet" | "in-person";
  };
  emails: {
    notifyAdmin: { newBooking: boolean; cancellation: boolean; reschedule: boolean };
    notifyClients: { confirmation: boolean; reminder: boolean; followUp: boolean };
    fromAddress: string;
  };
  account: {
    email: string;
    twoFactorEnabled: boolean;
    workspaceName: string;
  };
};
