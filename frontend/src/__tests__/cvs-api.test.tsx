import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CvUpload } from "@/components/cv-upload";
import { I18nProvider } from "@/i18n/provider";
import { CvsApiError, listCvs } from "@/lib/cvs-api";

vi.mock("@/lib/auth-session", () => ({
  getAuthAccessToken: vi.fn(() => "test-access-token"),
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
    expect(await screen.findByText("sample-resume.pdf")).toBeTruthy();

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

  it("shows the router-registration guidance when the CV list returns 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({ detail: "Not Found" }, 404)),
    );

    renderCvUpload();

    expect(
      await screen.findByText(
        "The CV API route is not registered yet. Ask Person A to mount it.",
      ),
    ).toBeTruthy();
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
