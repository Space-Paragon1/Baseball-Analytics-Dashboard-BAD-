import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import StatTable, { Column, sortRows } from "../../components/StatTable";

interface Row {
  id: number;
  name: string;
  era: number | null;
  so: number;
}

const rows: Row[] = [
  { id: 1, name: "Ace", era: 2.5, so: 100 },
  { id: 2, name: "Opener", era: null, so: 1 },
  { id: 3, name: "Starter", era: 4.1, so: 150 },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Player" },
  { key: "era", label: "ERA", numeric: true, lowerIsBetter: true, render: (r) => (r.era == null ? "—" : r.era.toFixed(2)) },
  { key: "so", label: "SO", numeric: true },
];

const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[1].textContent);

describe("sortRows", () => {
  it("keeps missing values last in both directions", () => {
    const col = columns[1];
    expect(sortRows(rows, col, false).map((r) => r.name)).toEqual(["Ace", "Starter", "Opener"]);
    expect(sortRows(rows, col, true).map((r) => r.name)).toEqual(["Starter", "Ace", "Opener"]);
  });
});

describe("StatTable", () => {
  it("applies the initial sort", () => {
    render(<StatTable columns={columns} rows={rows} rowKey={(r) => r.id} initialSort={{ key: "era", desc: false }} />);
    expect(names()).toEqual(["Ace", "Starter", "Opener"]);
  });

  it("sorts by a clicked header, best first, and flips on a second click", () => {
    render(<StatTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole("button", { name: "SO" }));
    expect(names()).toEqual(["Starter", "Ace", "Opener"]); // numeric stats start high-to-low
    fireEvent.click(screen.getByRole("button", { name: /SO/ }));
    expect(names()).toEqual(["Opener", "Ace", "Starter"]);
  });

  it("expands a row when clicked", () => {
    const onRowClick = jest.fn();
    render(
      <StatTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        expandedKey={1}
        renderExpanded={(r) => <div>Details for {r.name}</div>}
      />
    );
    expect(screen.getByText("Details for Ace")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Starter"));
    expect(onRowClick).toHaveBeenCalledWith(rows[2]);
  });

  it("shows the empty message", () => {
    render(<StatTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyMessage="Nobody here" />);
    expect(screen.getByText("Nobody here")).toBeInTheDocument();
  });
});
