import React from "react";
import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import StatsCard from "../../components/StatsCard";

describe("StatsCard", () => {
  const defaultProps = { title: "Batting Average", value: ".300", icon: Activity };

  it("renders title and value", () => {
    render(<StatsCard {...defaultProps} />);
    expect(screen.getByText("Batting Average")).toBeInTheDocument();
    expect(screen.getByText(".300")).toBeInTheDocument();
  });

  it("renders subtitle only when provided", () => {
    const { rerender } = render(<StatsCard {...defaultProps} />);
    expect(screen.queryByText("Season total")).not.toBeInTheDocument();
    rerender(<StatsCard {...defaultProps} subtitle="Season total" />);
    expect(screen.getByText("Season total")).toBeInTheDocument();
  });

  it.each([
    ["blue", "bg-blue-100"],
    ["green", "bg-emerald-100"],
    ["red", "bg-red-100"],
    ["purple", "bg-purple-100"],
  ] as const)("applies the %s colour", (color, cls) => {
    render(<StatsCard {...defaultProps} color={color} />);
    expect(screen.getByTestId("stats-card-icon")).toHaveClass(cls);
  });

  it("has dark-mode styles", () => {
    render(<StatsCard {...defaultProps} />);
    expect(screen.getByText(".300")).toHaveClass("dark:text-slate-100");
  });
});
