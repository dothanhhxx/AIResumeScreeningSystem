import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RankingReview } from "@/components/ranking-review";

afterEach(cleanup);

describe("RankingReview integration scaffold", () => {
  it("explains why ranking evidence is not displayed yet", () => {
    render(<RankingReview />);

    expect(
      screen.getByText(/Waiting for Person C's scoring contract/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/No candidate scores or ranking data/i),
    ).toBeTruthy();
    expect(screen.getByText(/People make hiring decisions/i)).toBeTruthy();
  });

  it("keeps ranking filters inactive until a real response is available", () => {
    render(<RankingReview />);

    expect(
      screen.getByRole("combobox", { name: "Job" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("combobox", { name: "Review status" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("textbox", { name: "Search candidates" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows the shared decision states without allowing an unpersisted decision", () => {
    render(<RankingReview />);

    const status = screen.getByRole("combobox", { name: "Decision status" });
    const values = within(status)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(values).toEqual([
      "pending",
      "shortlisted",
      "interview",
      "rejected",
      "hired",
    ]);
    expect(status.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByRole("textbox", { name: "Reason" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("textbox", { name: "Reviewer note" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Save recruiter decision" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByText(/real match result and the decision API/i),
    ).toBeTruthy();
  });
});
