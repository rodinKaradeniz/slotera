"use client";

import * as React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

/**
 * Confirmation dialog primitive. Thin wrapper around `Modal` for destructive
 * or significant actions that previously used the browser's `confirm()`
 * (which clashes with the design system, can't be styled, and isn't always
 * announced predictably by screen readers).
 *
 * Used for: cancel booking, cancel session, delete service, delete location,
 * cancel subscription, etc.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Label of the action button. Defaults to "Confirm". */
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** When true, the action button uses the danger variant. */
  destructive?: boolean;
  /** External busy state — disables both buttons. */
  busy?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  busy,
}: Props) {
  const variant = destructive ? "danger" : "primary";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
