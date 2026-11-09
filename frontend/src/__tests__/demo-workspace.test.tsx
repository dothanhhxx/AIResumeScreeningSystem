import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoWorkspace } from "@/features/marketing/demo-workspace";
import { I18nProvider } from "@/i18n/provider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DemoWorkspace", () => {
  it("shows synthetic evidence without making API requests", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <I18nProvider>
        <DemoWorkspace />
      </I18nProvider>,
    );

    expect(screen.getByText("Safe demo mode")).toBeTruthy();
    expect(
      screen.getByText(
        /This page makes no API requests and does not save changes/,
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Candidate review/ }));
    expect(screen.getByText("Review evidence, not just a number")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Candidate 02/ }));
    expect(
      screen.getByText(
        "Maintained warehouse queries used in monthly product reviews.",
      ),
    ).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
