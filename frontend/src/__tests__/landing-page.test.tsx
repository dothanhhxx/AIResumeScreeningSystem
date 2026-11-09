import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LandingPage } from "@/features/marketing/landing-page";
import { I18nProvider } from "@/i18n/provider";
import { AuthSessionProvider } from "@/providers/auth-session";

afterEach(() => {
  cleanup();
});

describe("LandingPage", () => {
  it("renders the unified TalentLens brand, interactive evidence preview, and vision/mission sections", () => {
    render(
      <I18nProvider>
        <AuthSessionProvider>
          <LandingPage />
        </AuthSessionProvider>
      </I18nProvider>,
    );

    // Brand tagline and Vision & Mission sections
    expect(
      screen.getAllByText("From resume noise to explainable hiring clarity.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("OUR VISION")).toBeTruthy();
    expect(screen.getByText("OUR MISSION")).toBeTruthy();

    // Interactive Evidence Explorer defaults to blind review (Candidate 01)
    expect(
      screen.getByText("Test-drive requirement matching right here"),
    ).toBeTruthy();
    expect(screen.queryByText("Linh Tran")).toBeNull();

    // Turning off blind review reveals candidate names
    const blindToggle = screen.getByRole("checkbox", {
      name: /Blind review \(hide identity\)/i,
    });
    fireEvent.click(blindToggle);
    expect(screen.getAllByText("Linh Tran").length).toBeGreaterThan(0);

    // Selecting Candidate 02 updates the inspected evidence panel
    fireEvent.click(screen.getByRole("button", { name: /Minh Pham/i }));
    expect(
      screen.getByText(
        /Maintained warehouse queries used in monthly product reviews\./,
      ),
    ).toBeTruthy();
  });
});
