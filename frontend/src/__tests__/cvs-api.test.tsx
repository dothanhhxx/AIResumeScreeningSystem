import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CvUpload } from "@/components/cv-upload";
import { I18nProvider } from "@/i18n/provider";
import { CvsApiError, listCvs } from "@/lib/cvs-api";

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

function renderCvUpload() {
  return render(
    <I18nProvider>
      <CvUpload />
    </I18nProvider>,
  );
}

describe("CV upload and library integration", () => {
  it("uploads one candidate CV with bearer auth, then refreshes the library", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");

    const emptyPage = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    };
    const cv = {
      id: 42,
      candidate_name: "Sample Candidate",
      candidate_email: "sample@example.test",
      file_name: "sample-resume.pdf",
      file_type: "pdf",
      file_size: 8,
      status: "uploaded",
      uploaded_by: 7,
      created_at: "2026-10-30T10:00:00Z",
    };
    const populatedPage = {
      items: [cv],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ success: true, message: "OK", data: emptyPage }),
      )
      .mockResolvedValueOnce(
        mockResponse({ success: true, message: "Uploaded", data: cv }, 201),
      )
      .mockResolvedValueOnce(
        mockResponse({ success: true, message: "OK", data: populatedPage }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderCvUpload();
    expect(
      await screen.findByText("No resumes have been uploaded yet."),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Candidate full name/), {
      target: { value: "Sample Candidate" },
    });
    fireEvent.change(screen.getByLabelText(/Candidate email/), {
      target: { value: "sample@example.test" },
    });
    const file = new File(["synthetic"], "sample-resume.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Choose resume file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));

    expect(
      await screen.findByText(
        "Uploaded Sample Candidate as CV #42. Current status: Uploaded.",
      ),
    ).toBeTruthy();
    // Shown both in the upload queue row and in the refreshed library list.
    await waitFor(() =>
      expect(screen.getAllByText("sample-resume.pdf").length).toBe(2),
    );

    const uploadCall = fetchMock.mock.calls[1];
    expect(uploadCall?.[0]).toBe("https://api.example.test/api/v1/cvs/upload");
    const uploadOptions = uploadCall?.[1] as RequestInit;
    expect(uploadOptions.credentials).toBe("omit");
    const headers = new Headers(uploadOptions.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-access-token");
    expect(headers.get("Content-Type")).toBeNull();

    const body = uploadOptions.body as FormData;
    expect(body.get("candidate_name")).toBe("Sample Candidate");
    expect(body.get("candidate_email")).toBe("sample@example.test");
    expect(body.get("file")).toBeInstanceOf(File);
    expect((body.get("file") as File).name).toBe("sample-resume.pdf");
  });

  it("uploads a PDF/DOCX without manual name entry and auto-opens the scanned CV detail panel", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");

    const emptyPage = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    };
    const cvSummary = {
      id: 88,
      candidate_name: "Le Minh Khoi",
      candidate_email: "minh.khoi@talentlens.test",
      file_name: "CV_Le_Minh_Khoi_2026.docx",
      file_type: "docx",
      file_size: 1024,
      status: "extracted",
      uploaded_by: 7,
      created_at: "2026-10-30T10:00:00Z",
    };
    const cvDetail = {
      ...cvSummary,
      error_message: null,
      file_url: "resumes/88.docx",
      raw_text: "Le Minh Khoi\nEmail: minh.khoi@talentlens.test\nSkills: Python, FastAPI",
      structured_data: JSON.stringify({
        summary: "Senior Python backend engineer",
        skills: ["Python", "FastAPI", "PostgreSQL"],
        years_of_experience: 6,
        experiences: [],
        education: [],
        certifications: [],
        languages: ["English"],
        extraction_source: "heuristic",
      }),
      updated_at: "2026-10-30T10:00:05Z",
    };

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/cvs/upload") && init?.method === "POST") {
        return Promise.resolve(
          mockResponse({ success: true, message: "Uploaded", data: cvSummary }, 201),
        );
      }
      if (url.endsWith("/cvs/88")) {
        return Promise.resolve(
          mockResponse({ success: true, message: "OK", data: cvDetail }),
        );
      }
      return Promise.resolve(
        mockResponse({ success: true, message: "OK", data: emptyPage }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCvUpload();
    await screen.findByText("No resumes have been uploaded yet.");

    const file = new File(
      ["synthetic docx"],
      "CV_Le_Minh_Khoi_2026.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    );
    fireEvent.change(screen.getByLabelText("Choose resume file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));

    expect(
      await screen.findByRole("heading", { name: "Le Minh Khoi" }),
    ).toBeTruthy();
    expect(await screen.findByText("Python")).toBeTruthy();
    expect(await screen.findByText("FastAPI")).toBeTruthy();
    expect(
      await screen.findByRole("link", { name: "Score & review against jobs" }),
    ).toBeTruthy();

    const uploadCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/cvs/upload"),
    );
    const body = (uploadCall?.[1] as RequestInit).body as FormData;
    expect(body.get("candidate_name")).toBeNull();
    expect(body.get("candidate_email")).toBeNull();
    expect((body.get("file") as File).name).toBe("CV_Le_Minh_Khoi_2026.docx");
  });

  it("rejects unsupported files in the UI without sending them", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const page = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ success: true, message: "OK", data: page }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderCvUpload();
    await screen.findByText("No resumes have been uploaded yet.");

    const invalidFile = new File(["synthetic"], "notes.txt", {
      type: "text/plain",
    });
    fireEvent.change(screen.getByLabelText("Choose resume file"), {
      target: { files: [invalidFile] },
    });

    expect(
      await screen.findByText("Choose a PDF or DOCX resume."),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a resume larger than 10 MB in the UI", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const page = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ success: true, message: "OK", data: page }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderCvUpload();
    await screen.findByText("No resumes have been uploaded yet.");

    const oversizedFile = new File(["synthetic"], "large-resume.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(oversizedFile, "size", {
      value: 10 * 1024 * 1024 + 1,
    });
    fireEvent.change(screen.getByLabelText("Choose resume file"), {
      target: { files: [oversizedFile] },
    });

    expect(
      await screen.findByText("The selected file exceeds the 10 MB limit."),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces an unregistered CV route as a controlled API error", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({ detail: "Not Found" }, 404)),
    );

    await expect(listCvs({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      name: "CvsApiError",
      message: "Not Found",
      status: 404,
    });
  });

  it("shows a clear message when the CV list returns 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({ detail: "Not Found" }, 404)),
    );

    renderCvUpload();

    expect(
      await screen.findByText("The CV API route is not available yet."),
    ).toBeTruthy();
  });

  it("opens the requested CV from a source link in the rankings page", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const page = {
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    };
    const detail = {
      id: 42,
      candidate_name: "Sample Candidate",
      candidate_email: null,
      file_name: "sample-resume.pdf",
      file_type: "pdf",
      file_size: 8,
      status: "scored",
      uploaded_by: 7,
      error_message: null,
      created_at: "2026-10-30T10:00:00Z",
      file_url: "resumes/42.pdf",
      raw_text: "Synthetic CV text",
      structured_data: null,
      updated_at: "2026-10-30T10:00:00Z",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/cvs?page=")) {
        return Promise.resolve(
          mockResponse({ success: true, message: "OK", data: page }),
        );
      }
      if (url.endsWith("/cvs/42")) {
        return Promise.resolve(
          mockResponse({ success: true, message: "OK", data: detail }),
        );
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <I18nProvider>
        <CvUpload requestedCvId={42} />
      </I18nProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Sample Candidate" }),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/cvs/42")),
    ).toBe(true);
  });

  it("does not send a request when the API base URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listCvs({ page: 1, pageSize: 10 })).rejects.toBeInstanceOf(
      CvsApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CV batch upload queue", () => {
  const emptyPage = {
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    total_pages: 0,
  };

  function summary(id: number, fileName: string) {
    return {
      id,
      candidate_name: `Candidate ${id}`,
      candidate_email: null,
      file_name: fileName,
      file_type: fileName.endsWith(".pdf") ? "pdf" : "docx",
      file_size: 9,
      status: "uploaded",
      uploaded_by: 7,
      created_at: "2026-10-30T10:00:00Z",
    };
  }

  function pdf(name: string) {
    return new File(["synthetic"], name, { type: "application/pdf" });
  }

  it("uploads several files in one go, one request per file, without name overrides", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    let nextId = 100;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/cvs/upload") && init?.method === "POST") {
        const file = (init.body as FormData).get("file") as File;
        nextId += 1;
        return Promise.resolve(
          mockResponse(
            { success: true, message: "OK", data: summary(nextId, file.name) },
            201,
          ),
        );
      }
      return Promise.resolve(
        mockResponse({ success: true, message: "OK", data: emptyPage }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCvUpload();
    await screen.findByText("No resumes have been uploaded yet.");

    fireEvent.change(screen.getByLabelText("Choose resume file"), {
      target: {
        files: [pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf"), pdf("d.pdf")],
      },
    });

    // Manual name/email fields are replaced by the batch-mode note.
    expect(screen.queryByLabelText(/Candidate full name/)).toBeNull();
    expect(screen.getByText("Batch mode")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Upload 4 resumes" }));

    expect(
      await screen.findByText(
        "All 4 resumes were uploaded and queued for scanning.",
      ),
    ).toBeTruthy();

    const uploadCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/cvs/upload"),
    );
    expect(uploadCalls).toHaveLength(4);
    const names = uploadCalls.map(
      ([, init]) => ((init!.body as FormData).get("file") as File).name,
    );
    expect(names.sort()).toEqual(["a.pdf", "b.pdf", "c.pdf", "d.pdf"]);
    for (const [, init] of uploadCalls) {
      expect((init!.body as FormData).get("candidate_name")).toBeNull();
    }
    expect(screen.getAllByRole("button", { name: /^View / })).toHaveLength(4);
  });

  it("keeps valid files, reports skipped ones, and lets failed files be retried", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    let failOnce = true;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/cvs/upload") && init?.method === "POST") {
        const file = (init.body as FormData).get("file") as File;
        if (file.name === "broken.pdf" && failOnce) {
          failOnce = false;
          return Promise.resolve(
            mockResponse({ detail: "Could not read this PDF." }, 400),
          );
        }
        return Promise.resolve(
          mockResponse(
            {
              success: true,
              message: "OK",
              data: summary(file.name === "ok.pdf" ? 1 : 2, file.name),
            },
            201,
          ),
        );
      }
      return Promise.resolve(
        mockResponse({ success: true, message: "OK", data: emptyPage }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCvUpload();
    await screen.findByText("No resumes have been uploaded yet.");

    fireEvent.change(screen.getByLabelText("Choose resume file"), {
      target: {
        files: [pdf("ok.pdf"), pdf("broken.pdf"), new File(["x"], "notes.txt")],
      },
    });
    expect(
      screen.getByText(
        "Skipped 1 files (only PDF or DOCX up to 10 MB): notes.txt",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Upload 2 resumes" }));
    expect(
      await screen.findByText(
        "1 resumes uploaded, 1 failed. Check the highlighted files and retry.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Could not read this PDF.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry failed (1)" }));
    expect(
      await screen.findByText(/Uploaded Candidate 2 as CV #2/),
    ).toBeTruthy();
    expect(screen.queryByText("Could not read this PDF.")).toBeNull();
  });
});
