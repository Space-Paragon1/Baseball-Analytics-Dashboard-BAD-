import {
  formatAvg,
  formatDate,
  formatIP,
  formatPct,
  formatRate,
  formatSigned,
  formatWhen,
  lastName,
  ordinal,
  outsToIP,
} from "../../utils/format";

describe("formatAvg", () => {
  it.each([
    [0.3, ".300"],
    [0.333, ".333"],
    [0, ".000"],
    [1, "1.000"],
    [1.418, "1.418"],
    [0.0005, ".001"],
  ])("formats %p as %p", (input, expected) => {
    expect(formatAvg(input)).toBe(expected);
  });

  it("shows a dash for missing values", () => {
    expect(formatAvg(null)).toBe("—");
    expect(formatAvg(undefined)).toBe("—");
    expect(formatAvg(NaN)).toBe("—");
  });
});

describe("formatRate / formatPct / formatSigned", () => {
  it("formats rates", () => {
    expect(formatRate(3.014)).toBe("3.01");
    expect(formatRate(10.3, 1)).toBe("10.3");
    expect(formatRate(null)).toBe("—");
  });

  it("formats percentages", () => {
    expect(formatPct(0.231)).toBe("23.1%");
    expect(formatPct(0)).toBe("0.0%");
  });

  it("adds a plus sign to positive numbers", () => {
    expect(formatSigned(5)).toBe("+5");
    expect(formatSigned(-3)).toBe("-3");
    expect(formatSigned(0)).toBe("0");
    expect(formatSigned(null)).toBe("—");
  });
});

describe("innings", () => {
  it("formats innings in box-score notation", () => {
    expect(formatIP(6.1)).toBe("6.1");
    expect(formatIP(119.2)).toBe("119.2");
  });

  it("converts outs to innings", () => {
    expect(outsToIP(0)).toBe("0.0");
    expect(outsToIP(19)).toBe("6.1");
    expect(outsToIP(20)).toBe("6.2");
    expect(outsToIP(27)).toBe("9.0");
  });
});

describe("text helpers", () => {
  it("formats ISO dates without timezone shifts", () => {
    expect(formatDate("2025-03-15")).toBe("Mar 15, 2025");
    expect(formatDate("2025-12-01", false)).toBe("Dec 1");
    expect(formatDate(null)).toBe("—");
  });

  it("shortens names for chart labels", () => {
    expect(lastName("Marcus Rivera")).toBe("Rivera");
    expect(lastName("Ronald Acuña Jr.")).toBe("Acuña Jr.");
    expect(lastName("Ichiro")).toBe("Ichiro");
  });

  it("makes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd",
    ]);
  });
});

describe("formatWhen", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it.each([
    [ago(20), "just now"],
    [ago(5 * 60), "5 min ago"],
    [ago(3 * 3600), "3 hr ago"],
    [ago(30 * 3600), "yesterday"],
    [ago(3 * 86400), "3 days ago"],
  ])("%s -> %s", (iso, expected) => {
    expect(formatWhen(iso, now)).toBe(expected);
  });

  it("shows a date for older timestamps and a dash for none", () => {
    expect(formatWhen("2025-03-15T12:00:00Z", now)).toMatch(/^Mar 1[45], 2025$/); // local time zone
    expect(formatWhen(null, now)).toBe("—");
    expect(formatWhen("not a date", now)).toBe("not a date");
  });
});
