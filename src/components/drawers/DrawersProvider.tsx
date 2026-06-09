"use client";

import * as React from "react";
import { BookingDrawer, type BookingDrawerProps } from "./BookingDrawer";
import { SessionDrawer, type SessionDrawerProps } from "./SessionDrawer";
import { ServiceDrawer, type ServiceDrawerProps } from "./ServiceDrawer";
import { FormDrawer, type FormDrawerProps } from "./FormDrawer";

type State =
  | { type: "none" }
  | { type: "booking"; props: Omit<BookingDrawerProps, "open" | "onClose"> }
  | { type: "session"; props: Omit<SessionDrawerProps, "open" | "onClose"> }
  | { type: "service"; props: Omit<ServiceDrawerProps, "open" | "onClose"> }
  | { type: "form"; props: Omit<FormDrawerProps, "open" | "onClose"> };

type Ctx = {
  openBookingDrawer: (props?: Omit<BookingDrawerProps, "open" | "onClose">) => void;
  openSessionDrawer: (props?: Omit<SessionDrawerProps, "open" | "onClose">) => void;
  openServiceDrawer: (props?: Omit<ServiceDrawerProps, "open" | "onClose">) => void;
  openFormDrawer: (props?: Omit<FormDrawerProps, "open" | "onClose">) => void;
  close: () => void;
};

const DrawersContext = React.createContext<Ctx | null>(null);

export function useDrawers() {
  const ctx = React.useContext(DrawersContext);
  if (!ctx) throw new Error("useDrawers must be used within DrawersProvider");
  return ctx;
}

export function DrawersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>({ type: "none" });

  const value = React.useMemo<Ctx>(
    () => ({
      openBookingDrawer: (props = {}) =>
        setState({ type: "booking", props }),
      openSessionDrawer: (props = {}) =>
        setState({ type: "session", props }),
      openServiceDrawer: (props = {}) =>
        setState({ type: "service", props }),
      openFormDrawer: (props = {}) =>
        setState({ type: "form", props }),
      close: () => setState({ type: "none" }),
    }),
    [],
  );

  return (
    <DrawersContext.Provider value={value}>
      {children}
      <BookingDrawer
        open={state.type === "booking"}
        onClose={value.close}
        {...(state.type === "booking" ? state.props : {})}
      />
      <SessionDrawer
        open={state.type === "session"}
        onClose={value.close}
        {...(state.type === "session" ? state.props : {})}
      />
      <ServiceDrawer
        open={state.type === "service"}
        onClose={value.close}
        {...(state.type === "service" ? state.props : {})}
      />
      <FormDrawer
        open={state.type === "form"}
        onClose={value.close}
        {...(state.type === "form" ? state.props : {})}
      />
    </DrawersContext.Provider>
  );
}
