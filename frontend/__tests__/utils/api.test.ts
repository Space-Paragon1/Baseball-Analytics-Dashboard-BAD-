import { AxiosError, AxiosHeaders } from "axios";
import { exportUrl, getErrorList, getErrorMessage, rangeParams } from "../../utils/api";

function apiError(status: number, data: unknown): AxiosError {
  const err = new AxiosError("Request failed", "ERR_BAD_REQUEST");
  err.response = { status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
  return err;
}

describe("getErrorMessage", () => {
  it("reads a string detail", () => {
    expect(getErrorMessage(apiError(409, { detail: "That username is taken." }))).toBe("That username is taken.");
  });

  it("joins validation errors without the body prefix", () => {
    const err = apiError(422, {
      detail: [
        { loc: ["body", "password"], msg: "Value error, Password must be at least 8 characters." },
        { loc: ["body", "email"], msg: "value is not a valid email address" },
      ],
    });
    expect(getErrorMessage(err)).toBe(
      "password: Password must be at least 8 characters.; email: value is not a valid email address"
    );
  });

  it("reads an upload error object and its row list", () => {
    const err = apiError(400, { detail: { message: "No changes were made.", errors: ["Row 6: at_bats: bad"] } });
    expect(getErrorMessage(err)).toBe("No changes were made.");
    expect(getErrorList(err)).toEqual(["Row 6: at_bats: bad"]);
  });

  it("explains network failures", () => {
    expect(getErrorMessage(new AxiosError("Network Error"))).toMatch(/Can't reach the API/);
  });

  it("falls back for unknown errors", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("weird", "fallback")).toBe("fallback");
  });
});

describe("URL helpers", () => {
  it("builds export URLs and skips empty params", () => {
    expect(exportUrl("/export/batting-csv", { start_date: "2025-04-01", team: "", qualified_only: false })).toBe(
      "http://localhost:8000/export/batting-csv?start_date=2025-04-01"
    );
    expect(exportUrl("/export/pitching-csv", { qualified_only: true })).toBe(
      "http://localhost:8000/export/pitching-csv?qualified_only=true"
    );
  });

  it("maps a date range to query params", () => {
    expect(rangeParams({ start: "2025-04-01", end: "" })).toEqual({ start_date: "2025-04-01" });
    expect(rangeParams(undefined)).toEqual({});
  });
});
