import React from "react";
import { render, screen } from "@testing-library/react";
import LoadingSpinner from "../../components/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders without crashing", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("displays loading text", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  it("has an animated spinner element", () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("matches snapshot", () => {
    const { asFragment } = render(<LoadingSpinner />);
    expect(asFragment()).toMatchSnapshot();
  });
});
