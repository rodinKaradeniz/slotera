export type Operator = {
  id: string;
  name: string;
  email: string;
  workspaceName: string;
  avatarInitials: string;
  createdAtISO: string;
};

export type Session = {
  token: string;
  operator: Operator;
};

export type OnboardingState = {
  service: boolean;
  availability: boolean;
  share: boolean;
};
