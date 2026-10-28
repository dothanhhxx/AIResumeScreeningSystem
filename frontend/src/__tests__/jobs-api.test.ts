import { afterEach, describe, expect, it, vi } from "vitest";
import { JobsApiError, listJobs } from "@/lib/jobs-api";

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
  it("sends the agreed pagination and status query with cookie credentials", async () => {
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
      "https://api.example.test/jobs?page=2&page_size=10&status=active",
      expect.objectContaining({ credentials: "include" }),
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
});
