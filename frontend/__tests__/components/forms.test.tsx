import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DateRangePicker from "../../components/DateRangePicker";
import { Diamond, Outs } from "../../components/GameBoard";
import { emptyRecord, validateRecord } from "../../components/RecordForm";

const asForm = (overrides: Record<string, string | number>) =>
  Object.fromEntries(
    Object.entries({
      ...emptyRecord(),
      player_name: "A",
      team: "Eagles",
      position: "CF",
      game_date: "2025-05-01",
      game_id: "G1",
      opponent: "Tigers",
      ...overrides,
    }).map(([k, v]) => [k, String(v)])
  );

describe("validateRecord", () => {
  it("accepts a valid line", () => {
    expect(validateRecord(asForm({ at_bats: 4, hits: 2, home_runs: 1 }))).toBeNull();
    expect(validateRecord(asForm({ innings_pitched: 6.2 }))).toBeNull();
  });

  it.each([
    [{ player_name: "" }, "player name"],
    [{ opponent: "eagles" }, "different"],
    [{ at_bats: 2, hits: 3 }, "Hits"],
    [{ at_bats: 4, hits: 1, doubles: 1, home_runs: 1 }, "Doubles"],
    [{ innings_pitched: 6.5 }, "thirds"],
    [{ hits_allowed: 1, home_runs_allowed: 2 }, "Home runs allowed"],
  ])("rejects %p", (overrides, message) => {
    expect(validateRecord(asForm(overrides))).toMatch(message);
  });
});

describe("DateRangePicker", () => {
  it("reports changes and clears", () => {
    const onChange = jest.fn();
    const { rerender } = render(<DateRangePicker value={{ start: "", end: "" }} onChange={onChange} />);
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2025-04-01" } });
    expect(onChange).toHaveBeenCalledWith({ start: "2025-04-01", end: "" });

    rerender(<DateRangePicker value={{ start: "2025-04-01", end: "" }} onChange={onChange} />);
    fireEvent.click(screen.getByText("Clear"));
    expect(onChange).toHaveBeenLastCalledWith({ start: "", end: "" });
  });
});

describe("Game Mode board", () => {
  it("marks occupied bases", () => {
    render(<Diamond bases={["Rivera", null, "Cole"]} />);
    expect(screen.getByTestId("base-first")).toHaveAttribute("data-occupied", "true");
    expect(screen.getByTestId("base-second")).toHaveAttribute("data-occupied", "false");
    expect(screen.getByTestId("base-third")).toHaveAttribute("data-occupied", "true");
    expect(screen.getByLabelText("Runners: 1st Rivera, 3rd Cole")).toBeInTheDocument();
  });

  it("shows the out count", () => {
    render(<Outs outs={2} />);
    expect(screen.getByLabelText("2 outs")).toBeInTheDocument();
  });
});
