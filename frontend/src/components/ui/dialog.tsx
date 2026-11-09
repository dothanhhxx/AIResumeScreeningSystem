"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";

/**
 * Accessible modal: Escape closes it, focus moves inside on open, Tab stays
 * inside, and focus returns to whatever opened it. Uses the shared modal styles.
 */
export function Dialog({
  titleId,
  eyebrow,
  title,
  onClose,
  role = "dialog",
  className = "",
  children,
}: {
  titleId: string;
  eyebrow?: string;
  title: string;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  className?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]",
        ) ?? [],
      );
    // Confirmations start on Cancel so Enter never destroys anything by accident;
    // forms start on their first field.
    const cancel = panel?.querySelector<HTMLElement>(
      ".confirm-actions .button-secondary",
    );
    const firstField = focusable().find((el) => el.tagName !== "BUTTON");
    (role === "alertdialog" ? cancel : (firstField ?? focusable()[0]))?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [role]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={`modal-card ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="modal-header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label={t("Close dialog")}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
