import React from "react";
import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import StatsCard from "../../components/StatsCard";

describe("StatsCard", () => {
  const defaultProps = {
    title: "Batting Average",
    value: ".300",
    icon: Activity,
  };

  it("renders title and value", () => {
    render(<StatsCard {...defaultProps} />);
    expect(screen.getByText("Batting Average")).toBeInTheDocument();
    expect(screen.getByText(".300")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<StatsCard {...defaultProps} subtitle="Season total" />);
    expect(screen.getByText("Season total")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    render(<StatsCard {...defaultProps} />);
    expect(screen.queryByText("Season total")).not.toBeInTheDocument();
  });

  it("renders trend indicator when trend='up'", () => {
    render(<StatsCard {...defaultProps} trend="up" />);
    expect(screen.getByText("Trending up")).toBeInTheDocument();
  });

  it("renders trend indicator when trend='down'", () => {
    render(<StatsCard {...defaultProps} trend="down" />);
    expect(screen.getByText("Trending down")).toBeInTheDocument();
  });

  it("does not render trend indicator when trend='neutral'", () => {
    render(<StatsCard {...defaultProps} trend="neutral" />);
    expect(screen.queryByText("Trending up")).not.toBeInTheDocument();
    expect(screen.queryByText("Trending down")).not.toBeInTheDocument();
  });

  it("applies correct color class based on color prop - green", () => {
    const { container } = render(<StatsCard {...defaultProps} color="green" />);
    expect(container.querySelector(".bg-emerald-100")).toBeInTheDocument();
  });

  it("applies correct color class based on color prop - blue (default)", () => {
    const { container } = render(<StatsCard {...defaultProps} color="blue" />);
    expect(container.querySelector(".bg-blue-100")).toBeInTheDocument();
  });

  it("applies correct color class based on color prop - red", () => {
    const { container } = render(<StatsCard {...defaultProps} color="red" />);
    expect(container.querySelector(".bg-red-100")).toBeInTheDocument();
  });

  it("matches snapshot", () => {
    const { asFragment } = render(
      <StatsCard
        {...defaultProps}
        subtitle="Test subtitle"
        trend="up"
        color="green"
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
