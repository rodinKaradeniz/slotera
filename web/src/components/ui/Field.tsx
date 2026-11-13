"use client";
import { useI18n } from "@/components/i18n/I18nProvider";
import * as React from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

type FieldProps = {
  label?: string;
  group?: boolean;
  hint?: string;
  error?: string;
  optional?: boolean;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function Field({
  label,
  group = false,
  hint,
  error,
  optional,
  required,
  children,
  className,
}: FieldProps) {
  const { t: uiText } = useI18n();
  const Container = group ? "fieldset" : "label";
  const Heading = group ? "legend" : "div";
  return (
    <Container className={cn("min-w-0 flex flex-col gap-1.5", className)}>
      {label && (
        <Heading className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink">
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </span>
          {optional && (
            <span className="text-[11px] text-ink-3 font-mono uppercase tracking-wider">
              {uiText("ui.optional")}</span>
          )}
        </Heading>
      )}
      {children}
      {error && (
        <span className="text-[12px] text-danger inline-flex items-center gap-1">
          <Icon name="info" size={12} /> {error}
        </span>
      )}
      {!error && hint && (
        <span className="text-[12px] text-ink-3">{hint}</span>
      )}
    </Container>
  );
}
