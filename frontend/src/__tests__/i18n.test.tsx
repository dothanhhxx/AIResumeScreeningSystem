import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "@/components/language-switcher";
import { I18nProvider, useI18n } from "@/i18n/provider";

function TranslationProbe() {
  const { t } = useI18n();
  return <span>{t("Overview")}</span>;
}

function renderLanguageControls() {
  return render(
    <I18nProvider>
      <TranslationProbe />
      <LanguageSwitcher />
    </I18nProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = "en";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("language selection", () => {
  it("switches the interface to Vietnamese and saves the preference", async () => {
    renderLanguageControls();

    expect(await screen.findByText("Overview")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Switch display language to Vietnamese",
      }),
    );

    expect(await screen.findByText("Tổng quan")).toBeTruthy();
    expect(window.localStorage.getItem("talentlens-language")).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");
  });

  it("restores the saved language when the app opens", async () => {
    window.localStorage.setItem("talentlens-language", "vi");

    renderLanguageControls();

    expect(await screen.findByText("Tổng quan")).toBeTruthy();
    expect(document.documentElement.lang).toBe("vi");
  });

  it("still switches languages when browser storage is unavailable", async () => {
    renderLanguageControls();
    expect(await screen.findByText("Overview")).toBeTruthy();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable.", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable.", "SecurityError");
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Switch display language to Vietnamese",
      }),
    );

    expect(await screen.findByText("Tổng quan")).toBeTruthy();
    expect(document.documentElement.lang).toBe("vi");
  });
});
