export type UserRole = "operator_admin" | "superadmin";

export type Operator = {
  id: string;
  title?: string;
  firstNames: string;
  lastName: string;
  name: string;
  email: string;
  workspaceName: string;
  avatarInitials: string;
  createdAtISO: string;
  role?: UserRole;
};

export type Session = {
  token: string;
  operator: Operator;
  role: UserRole;
};

export type OnboardingState = {
  service: boolean;
  availability: boolean;
  payments: boolean;
  share: boolean;
};
