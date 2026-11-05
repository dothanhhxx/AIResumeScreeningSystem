import { describe, expect, it } from "vitest";
import { fileNameFromDisposition } from "@/lib/api";

describe("fileNameFromDisposition", () => {
  it("prefers the RFC 5987 UTF-8 name so Vietnamese names survive", () => {
    expect(
      fileNameFromDisposition(
        "attachment; filename=\"CV_Nguy_n_V_n_A.pdf\"; filename*=UTF-8''CV_Nguy%E1%BB%85n_V%C4%83n_A.pdf",
      ),
    ).toBe("CV_Nguyễn_Văn_A.pdf");
  });

  it("falls back to the plain filename", () => {
    expect(fileNameFromDisposition('attachment; filename="resume.docx"')).toBe(
      "resume.docx",
    );
    expect(fileNameFromDisposition("attachment; filename=resume.pdf")).toBe(
      "resume.pdf",
    );
  });

  it("returns null when no name is present", () => {
    expect(fileNameFromDisposition("attachment")).toBeNull();
    expect(fileNameFromDisposition("")).toBeNull();
  });
});
