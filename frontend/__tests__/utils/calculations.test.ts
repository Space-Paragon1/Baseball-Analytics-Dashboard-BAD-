import {
  battingAverage,
  obp,
  slg,
  ops,
  era,
  whip,
  formatAvg,
} from "../../utils/calculations";

describe("battingAverage", () => {
  it("calculates batting average correctly", () => {
    expect(battingAverage(3, 10)).toBeCloseTo(0.3);
  });

  it("returns 0 when at bats is 0 (division by zero)", () => {
    expect(battingAverage(0, 0)).toBe(0);
  });

  it("returns 1 for perfect batting", () => {
    expect(battingAverage(5, 5)).toBe(1);
  });
});

describe("obp", () => {
  it("calculates OBP correctly", () => {
    // (10 + 5 + 1) / (30 + 5 + 1) = 16/36 ≈ 0.444
    expect(obp(10, 5, 1, 30)).toBeCloseTo(16 / 36);
  });

  it("returns 0 when denominator is 0 (division by zero)", () => {
    expect(obp(0, 0, 0, 0)).toBe(0);
  });
});

describe("slg", () => {
  it("calculates slugging percentage correctly", () => {
    // (5 + 2*3 + 3*1 + 4*2) / 20 = (5+6+3+8)/20 = 22/20 = 1.1
    expect(slg(5, 3, 1, 2, 20)).toBeCloseTo(1.1);
  });

  it("returns 0 when at bats is 0 (division by zero)", () => {
    expect(slg(0, 0, 0, 0, 0)).toBe(0);
  });

  it("calculates singles only", () => {
    expect(slg(4, 0, 0, 0, 10)).toBeCloseTo(0.4);
  });
});

describe("ops", () => {
  it("calculates OPS as sum of OBP and SLG", () => {
    expect(ops(0.35, 0.45)).toBeCloseTo(0.8);
  });

  it("returns 0 when both are 0", () => {
    expect(ops(0, 0)).toBe(0);
  });
});

describe("era", () => {
  it("calculates ERA correctly", () => {
    // (3 * 9) / 9 = 3.0
    expect(era(3, 9)).toBeCloseTo(3.0);
  });

  it("returns 0 when innings pitched is 0 (division by zero)", () => {
    expect(era(5, 0)).toBe(0);
  });
});

describe("whip", () => {
  it("calculates WHIP correctly", () => {
    // (3 + 7) / 9 ≈ 1.111
    expect(whip(3, 7, 9)).toBeCloseTo(10 / 9);
  });

  it("returns 0 when innings pitched is 0 (division by zero)", () => {
    expect(whip(2, 3, 0)).toBe(0);
  });
});

describe("formatAvg", () => {
  it("formats 0.3 as '.300'", () => {
    expect(formatAvg(0.3)).toBe(".300");
  });

  it("formats 0.333 as '.333'", () => {
    expect(formatAvg(0.333)).toBe(".333");
  });

  it("formats 0.0 as '.000'", () => {
    expect(formatAvg(0)).toBe(".000");
  });

  it("formats 1.0 as '1.000' with correct padding", () => {
    // 1.0 * 1000 = 1000, toString = "1000", padStart(3) doesn't truncate
    expect(formatAvg(1.0)).toBe(".1000");
  });

  it("formats 0.250 as '.250'", () => {
    expect(formatAvg(0.25)).toBe(".250");
  });
});
