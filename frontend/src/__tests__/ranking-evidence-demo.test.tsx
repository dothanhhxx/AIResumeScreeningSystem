import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RankingEvidenceDemo } from "@/components/ranking-evidence-demo";

afterEach(cleanup);

describe("RankingEvidenceDemo", () => {
  it("shows synthetic evidence and masks identity by default", () => {
    render(<RankingEvidenceDemo />);

    expect(screen.getByText(/Demo · synthetic data/i)).toBeTruthy();
    expect(screen.getByText("Sample candidate 01")).toBeTruthy();
    expect(screen.getByText("Identity details are hidden")).toBeTruthy();
    expect(screen.queryByText("linh.tran@example.test")).toBeNull();
    expect(screen.getByText("Evidence found")).toBeTruthy();
    expect(screen.getByText("Needs verification")).toBeTruthy();
    expect(screen.getByText("Not found in CV")).toBeTruthy();
    expect(
      screen.getByText(/does not mean the candidate lacks the skill/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/does not call the API or show real AI results/i),
    ).toBeTruthy();
  });

  it("reveals only the synthetic identity when blind review is turned off", () => {
    render(<RankingEvidenceDemo />);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Hide identifying details" }),
    );

    expect(screen.getByText("Linh Tran (synthetic profile)")).toBeTruthy();
    expect(screen.getByText("linh.tran@example.test")).toBeTruthy();
    expect(screen.queryByText("Sample candidate 01")).toBeNull();
  });
});
