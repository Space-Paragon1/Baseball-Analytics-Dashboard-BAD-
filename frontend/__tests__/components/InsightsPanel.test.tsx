import React from "react";
import { render, screen } from "@testing-library/react";
import InsightsPanel from "../../components/InsightsPanel";

describe("InsightsPanel", () => {
  const sampleInsights = [
    "Player A has a .350 batting average this season.",
    "Team Eagles leads in home runs with 45.",
    "Pitcher B has an ERA of 2.10.",
  ];

  it("renders all insights passed as props", () => {
    render(<InsightsPanel insights={sampleInsights} />);
    sampleInsights.forEach((insight) => {
      expect(screen.getByText(insight)).toBeInTheDocument();
    });
  });

  it("renders empty state when insights array is empty — returns null", () => {
    const { container } = render(<InsightsPanel insights={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when insights is empty (no heading rendered)", () => {
    const { queryByText } = render(<InsightsPanel insights={[]} />);
    expect(queryByText("Auto-Generated Insights")).not.toBeInTheDocument();
  });

  it("each insight is displayed as text", () => {
    render(<InsightsPanel insights={sampleInsights} />);
    sampleInsights.forEach((insight) => {
      const el = screen.getByText(insight);
      expect(el.tagName.toLowerCase()).toBe("p");
    });
  });

  it("renders the panel heading when insights are provided", () => {
    render(<InsightsPanel insights={sampleInsights} />);
    expect(screen.getByText("Auto-Generated Insights")).toBeInTheDocument();
  });
});
