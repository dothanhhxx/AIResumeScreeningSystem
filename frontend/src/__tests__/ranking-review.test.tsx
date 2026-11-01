import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RankingReview } from "@/components/ranking-review";
import { I18nProvider } from "@/i18n/provider";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const sessionRole = { current: "recruiter" as "recruiter" | "viewer" };
vi.mock("@/lib/auth-session", () => ({
  getAuthAccessToken: vi.fn(() => "test-access-token"),
  useAuthSession: () => ({
    session: {
      accessToken: "test-access-token",
      expiresAt: Date.now() + 60_000,
      user: { id: 1, full_name: "Rec", role: sessionRole.current },
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

function ok(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, message: "OK", data }),
  } as Response;
}

const job = {
  id: 3,
  title: "Python Backend Engineer",
  department: null,
  location: null,
  description: "APIs",
  requirements: null,
  required_skills: ["Python", "Kubernetes"],
  experience_years: 3,
  education_level: null,
  status: "active",
  created_by: 1,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

function match(id: number, name: string, score: number, rank: number) {
  return {
    id,
    cv_id: id * 10,
    job_id: 3,
    overall_score: score,
    effective_score: score,
    skill_score: score,
    experience_score: 100,
    education_score: null,
    rule_score: score,
    semantic_score: 60,
    llm_score: null,
    matched_skills: ["Python"],
    missing_skills: ["Kubernetes"],
    explanation: `Explanation for ${name}`,
    model_name: "heuristic",
    model_version: "hybrid-v1",
    rank,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: null,
    candidate: {
      cv_id: id * 10,
      candidate_name: name,
      candidate_email: null,
      file_name: `${name}.pdf`,
      status: "scored",
      skills: ["Python"],
      years_of_experience: 4,
    },
    decision: null,
    details: {
      strengths: ["Solid Python"],
      gaps: ["No Kubernetes evidence"],
      interview_questions: ["Describe a Kubernetes deployment."],
      evidence: [
        {
          requirement: "Python",
          category: "skill",
          status: "found",
          quote: "Built APIs with Python",
        },
        {
          requirement: "Kubernetes",
          category: "skill",
          status: "not_found",
          quote: null,
        },
      ],
      weights: { rule: 0.67, semantic: 0.33 },
      sources: {},
    },
  };
}

const ranking = {
  job_id: 3,
  job_title: job.title,
  total: 2,
  pending_cvs: 0,
  items: [match(1, "Alice Nguyen", 82, 1), match(2, "Bao Tran", 41, 2)],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
  sessionRole.current = "recruiter";
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/jobs?"))
      return ok({
        items: [job],
        total: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
      });
    if (url.endsWith("/matching/run"))
      return ok({ job_id: 3, queued: 2, cv_ids: [10, 20], skipped: [] });
    if (url.includes("/decision")) {
      const body = JSON.parse(String(init?.body));
      return ok({
        id: 9,
        ...body,
        decided_by: 1,
        updated_at: "2026-11-01T01:00:00Z",
      });
    }
    if (url.includes("/matching/jobs/3/results")) return ok(ranking);
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function renderReview() {
  return render(
    <I18nProvider>
      <RankingReview />
    </I18nProvider>,
  );
}

describe("RankingReview", () => {
  it("lists ranked candidates with identity hidden by default", async () => {
    renderReview();

    expect(
      (await screen.findAllByText("Candidate #10")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Candidate #20")).toBeTruthy();
    expect(screen.queryByText("Alice Nguyen")).toBeNull();

    fireEvent.click(screen.getByLabelText("Hide name and email"));
    expect((await screen.findAllByText("Alice Nguyen")).length).toBeGreaterThan(
      0,
    );
  });

  it("shows evidence, explanation and provenance for the selected candidate", async () => {
    renderReview();

    expect(
      await screen.findByText("Explanation for Alice Nguyen"),
    ).toBeTruthy();
    expect(screen.getByText("“Built APIs with Python”")).toBeTruthy();
    expect(screen.getByText("Not found in CV")).toBeTruthy();
    expect(screen.getByText("Describe a Kubernetes deployment.")).toBeTruthy();
    expect(screen.getByText(/LLM unavailable/)).toBeTruthy();

    fireEvent.click(screen.getByText("Candidate #20"));
    expect(await screen.findByText("Explanation for Bao Tran")).toBeTruthy();
  });

  it("starts a matching run for the selected job", async () => {
    renderReview();
    await screen.findAllByText("Candidate #10");

    fireEvent.click(screen.getByRole("button", { name: "Run AI matching" }));

    expect(
      await screen.findByText(/Scoring 2 CV\(s\) in the background/),
    ).toBeTruthy();
    const runCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/matching/run"),
    );
    expect(JSON.parse(String(runCall?.[1]?.body))).toEqual({
      job_id: 3,
      cv_ids: null,
    });
  });

  it("requires a reason before saving a score override", async () => {
    renderReview();
    await screen.findByText("Explanation for Alice Nguyen");

    const form = screen.getByRole("form", { name: "Review outcome" });
    fireEvent.change(within(form).getByLabelText("Decision status"), {
      target: { value: "shortlisted" },
    });
    fireEvent.change(within(form).getByLabelText("Adjusted score (optional)"), {
      target: { value: "90" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save recruiter decision" }),
    );
    expect(
      await screen.findByText("Give a reason when you adjust the AI score."),
    ).toBeTruthy();

    fireEvent.change(within(form).getByLabelText("Reason"), {
      target: { value: "Strong portfolio" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: "Save recruiter decision" }),
    );

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("/decision"),
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        status: "shortlisted",
        reason: "Strong portfolio",
        note: null,
        score_override: 90,
      });
    });
  });

  it("disables decisions for viewers", async () => {
    sessionRole.current = "viewer";
    renderReview();
    await screen.findByText("Explanation for Alice Nguyen");

    expect(
      screen
        .getByRole("button", { name: "Save recruiter decision" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Run AI matching" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
