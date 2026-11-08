import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJobFromFile, JobsApiError, listJobs } from "@/lib/jobs-api";

vi.mock("@/lib/auth-session", () => ({
  getAuthAccessToken: vi.fn(() => "test-access-token"),
}));

afterEach(() => {
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

describe("jobs API client", () => {
  it("sends API-v1 pagination and status with the bearer access token", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const page = {
      items: [],
      total: 0,
      page: 2,
      page_size: 10,
      total_pages: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ success: true, message: "OK", data: page }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      listJobs({ page: 2, pageSize: 10, status: "active" }),
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/jobs?page=2&page_size=10&status=active",
      expect.objectContaining({
        credentials: "omit",
        headers: expect.any(Headers),
      }),
    );
    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(requestOptions.headers).get("Authorization")).toBe(
      "Bearer test-access-token",
    );
  });

  it("returns a controlled API error for a malformed successful response", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse("unexpected")),
    );

    await expect(listJobs({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      name: "JobsApiError",
      message: "The backend returned an invalid response.",
      status: 200,
    });
  });

  it("handles a primitive error response without throwing a parsing TypeError", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse("error", 503)),
    );

    const request = listJobs({ page: 1, pageSize: 10 });
    await expect(request).rejects.toBeInstanceOf(JobsApiError);
    await expect(request).rejects.toMatchObject({
      message: "Request failed (503).",
      status: 503,
    });
  });

  it("preserves the configuration error when the API URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listJobs({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      message: "Set NEXT_PUBLIC_API_BASE_URL to connect the backend.",
      status: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a JD file via FormData to /jobs/extract-file and returns extracted draft fields", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const extracted = {
      title: "Senior Python Backend Engineer",
      department: "Platform Engineering",
      location: "Hanoi / Remote",
      description: "Build and scale FastAPI services.",
      requirements: "4+ years of backend experience.",
      required_skills: ["Python", "FastAPI", "PostgreSQL"],
      experience_years: 4,
      education_level: "Bachelor's degree",
      file_name: "JD_Backend.docx",
      extraction_source: "heuristic",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ success: true, message: "OK", data: extracted }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(
      ["synthetic docx"],
      "JD_Backend.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    );
    await expect(extractJobFromFile(file)).resolves.toEqual(extracted);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/jobs/extract-file",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        body: expect.any(FormData),
      }),
    );
    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(requestOptions.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-access-token");
    expect(headers.get("Content-Type")).toBeNull();
  });
});
