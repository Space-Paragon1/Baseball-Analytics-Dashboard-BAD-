import { passwordProblem } from "../../utils/passwords";

describe("passwordProblem", () => {
  it("accepts a good password", () => {
    expect(passwordProblem("long-enough", "long-enough")).toBeNull();
    expect(passwordProblem("long-enough", "long-enough", "the-old-one")).toBeNull();
  });

  it.each([
    ["short", "short", undefined, /at least 8/],
    ["long-enough", "different", undefined, /don't match/],
    ["x".repeat(73), "x".repeat(73), undefined, /too long/],
    ["é".repeat(37), "é".repeat(37), undefined, /too long/], // 74 bytes in UTF-8
    ["same-as-before", "same-as-before", "same-as-before", /different from the current/],
  ])("rejects %s", (password, confirm, current, message) => {
    expect(passwordProblem(password, confirm, current)).toMatch(message);
  });
});
