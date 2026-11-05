import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "talentlens-auth-session";

function storeOldSession() {
  window.sessionStorage.setItem(
    KEY,
    JSON.stringify({
      accessToken: "token-1",
      expiresAt: Date.now() + 3_600_000,
      user: { id: 1, full_name: "Old Admin Name", role: "admin" },
    }),
  );
}

function mockMe(status: number, data?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            status === 200
              ? { success: true, data }
              : { success: false, message: "Unauthorized" },
          ),
          { status, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
}

async function renderWithSession() {
  // Fresh module per test: the session cache lives at module scope.
  vi.resetModules();
  const { AuthSessionProvider, useAuthSession } =
    await import("@/lib/auth-session");
  function Who() {
    const { session } = useAuthSession();
    return <p>{session ? session.user.full_name : "signed out"}</p>;
  }
  render(
    <AuthSessionProvider>
      <Who />
    </AuthSessionProvider>,
  );
}

describe("AuthSessionProvider", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://api.test");
    window.sessionStorage.clear();
    storeOldSession();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("refreshes the stored user from /auth/me on page load", async () => {
    mockMe(200, {
      id: 1,
      email: "admin@example.com",
      full_name: "New Admin Name",
      role: "admin",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    await renderWithSession();

    expect(await screen.findByText("New Admin Name")).toBeTruthy();
    const stored = JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}");
    expect(stored.user.full_name).toBe("New Admin Name");
    expect(stored.accessToken).toBe("token-1");
  });

  it("signs out when the token is rejected", async () => {
    mockMe(401);
    await renderWithSession();

    await waitFor(() => expect(screen.getByText("signed out")).toBeTruthy());
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });
});
