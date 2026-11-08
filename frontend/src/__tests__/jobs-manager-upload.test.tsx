import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobsManager } from "@/components/jobs-manager";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@/lib/auth-session", () => ({
  getAuthAccessToken: vi.fn(() => "test-access-token"),
  useAuthSession: () => ({
    session: {
      accessToken: "test-access-token",
      expiresAt: Date.now() + 60_000,
      user: { id: 7, full_name: "Recruiter", role: "recruiter" },
    },
    signIn: () => undefined,
    signOut: () => undefined,
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("JobsManager JD file upload and auto-fill", () => {
  it("uploads a JD file in the Create modal, pre-fills all form fields, allows editing, and saves the final job", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");

    const emptyPage = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    };
    const extracted = {
      title: "Senior Python Backend Engineer",
      department: "Platform Engineering",
      location: "Hanoi / Remote",
      description: "Design and scale FastAPI services.",
      requirements: "Minimum 4 years of backend experience.",
      required_skills: ["Python", "FastAPI", "PostgreSQL"],
      experience_years: 4,
      education_level: "Bachelor's degree",
      file_name: "JD_Senior_Backend.docx",
      extraction_source: "heuristic",
    };
    const createdJob = {
      id: 15,
      title: "Senior Python Backend Engineer (Edited)",
      department: "Platform Engineering",
      location: "Hanoi / Remote",
      description: "Design and scale FastAPI services.",
      requirements: "Minimum 4 years of backend experience.",
      required_skills: ["Python", "FastAPI", "PostgreSQL", "Docker"],
      experience_years: 5,
      education_level: "Bachelor's degree",
      status: "draft" as const,
      created_by: 7,
      created_at: "2026-11-08T10:00:00Z",
      updated_at: "2026-11-08T10:00:00Z",
    };

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/jobs/extract-file") && init?.method === "POST") {
        return Promise.resolve(
          mockResponse({ success: true, message: "OK", data: extracted }),
        );
      }
      if (url.endsWith("/jobs") && init?.method === "POST") {
        return Promise.resolve(
          mockResponse(
            { success: true, message: "Created", data: createdJob },
            201,
          ),
        );
      }
      if (url.endsWith("/jobs/15") && init?.method === "PATCH") {
        return Promise.resolve(
          mockResponse({
            success: true,
            message: "Updated",
            data: { ...createdJob, status: "active" },
          }),
        );
      }
      return Promise.resolve(
        mockResponse({ success: true, message: "OK", data: emptyPage }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <I18nProvider>
        <JobsManager />
      </I18nProvider>,
    );

    await screen.findByText("No job descriptions yet");
    fireEvent.click(screen.getByRole("button", { name: /New job/ }));

    expect(
      screen.getByRole("heading", { name: "Create a draft" }),
    ).toBeTruthy();

    const jdFile = new File(["synthetic docx"], "JD_Senior_Backend.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(screen.getByLabelText("Choose JD file"), {
      target: { files: [jdFile] },
    });

    expect(
      await screen.findByText(
        "Filled from JD_Senior_Backend.docx — review and edit any field below before saving.",
      ),
    ).toBeTruthy();

    const titleInput = screen.getByLabelText(/Job title/) as HTMLInputElement;
    const deptInput = screen.getByLabelText(/Department/) as HTMLInputElement;
    const locationInput = screen.getByLabelText(/Location/) as HTMLInputElement;
    const descInput = screen.getByLabelText(
      /Description/,
    ) as HTMLTextAreaElement;
    const reqInput = screen.getByLabelText(
      /Requirements/,
    ) as HTMLTextAreaElement;
    const skillsInput = screen.getByLabelText(
      /Required skills/,
    ) as HTMLTextAreaElement;
    const expInput = screen.getByLabelText(
      /Experience \(years\)/,
    ) as HTMLInputElement;
    const eduInput = screen.getByLabelText(
      /Education level/,
    ) as HTMLInputElement;

    expect(titleInput.value).toBe("Senior Python Backend Engineer");
    expect(deptInput.value).toBe("Platform Engineering");
    expect(locationInput.value).toBe("Hanoi / Remote");
    expect(descInput.value).toBe("Design and scale FastAPI services.");
    expect(reqInput.value).toBe("Minimum 4 years of backend experience.");
    expect(skillsInput.value).toBe("Python, FastAPI, PostgreSQL");
    expect(expInput.value).toBe("4");
    expect(eduInput.value).toBe("Bachelor's degree");

    // Edit the pre-filled values and select a custom scoring weight preset before saving
    fireEvent.change(titleInput, {
      target: { value: "Senior Python Backend Engineer (Edited)" },
    });
    fireEvent.change(skillsInput, {
      target: { value: "Python, FastAPI, PostgreSQL, Docker" },
    });
    fireEvent.change(expInput, { target: { value: "5" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Skills first (75/15/10)" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save job" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/jobs") && init?.method === "POST",
        ),
      ).toBe(true),
    );

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/jobs") && init?.method === "POST",
    );
    const savedPayload = JSON.parse(
      String((createCall?.[1] as RequestInit).body),
    );
    expect(savedPayload).toEqual({
      title: "Senior Python Backend Engineer (Edited)",
      department: "Platform Engineering",
      location: "Hanoi / Remote",
      description: "Design and scale FastAPI services.",
      requirements: "Minimum 4 years of backend experience.",
      required_skills: ["Python", "FastAPI", "PostgreSQL", "Docker"],
      experience_years: 5,
      education_level: "Bachelor's degree",
      scoring_weights: {
        skill: 75,
        experience: 15,
        education: 10,
        rule: 40,
        semantic: 20,
        llm: 40,
      },
    });
  });

  it("rejects unsupported JD file types in the modal without calling the backend", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const emptyPage = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ success: true, message: "OK", data: emptyPage }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <I18nProvider>
        <JobsManager />
      </I18nProvider>,
    );

    await screen.findByText("No job descriptions yet");
    fireEvent.click(screen.getByRole("button", { name: /New job/ }));

    const invalidFile = new File(["plain text"], "jd.txt", {
      type: "text/plain",
    });
    fireEvent.change(screen.getByLabelText("Choose JD file"), {
      target: { files: [invalidFile] },
    });

    expect(
      await screen.findByText("Choose a PDF or DOCX job description file."),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("/jobs/extract-file"),
      ),
    ).toBe(false);
  });
});

