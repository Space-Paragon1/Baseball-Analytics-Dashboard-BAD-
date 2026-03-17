import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "../../context/ToastContext";

// Helper component that exposes toast actions via buttons
function ToastTestHarness() {
  const { toasts, addToast, removeToast } = useToast();
  return (
    <div>
      <button
        onClick={() => addToast("Hello world", "success", 5000)}
        data-testid="add-success"
      >
        Add Success
      </button>
      <button
        onClick={() => addToast("Error msg", "error", 5000)}
        data-testid="add-error"
      >
        Add Error
      </button>
      <button
        onClick={() => {
          if (toasts.length > 0) {
            removeToast(toasts[0].id);
          }
        }}
        data-testid="remove-first"
      >
        Remove First
      </button>
      <ul data-testid="toast-list">
        {toasts.map((t) => (
          <li key={t.id} data-testid={`toast-${t.id}`}>
            {t.message}
          </li>
        ))}
      </ul>
      <span data-testid="toast-count">{toasts.length}</span>
    </div>
  );
}

describe("ToastContext", () => {
  it("addToast adds a toast to the list", () => {
    render(
      <ToastProvider>
        <ToastTestHarness />
      </ToastProvider>
    );

    expect(screen.getByTestId("toast-count").textContent).toBe("0");

    act(() => {
      fireEvent.click(screen.getByTestId("add-success"));
    });

    expect(screen.getByTestId("toast-count").textContent).toBe("1");
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("removeToast removes a toast by id", () => {
    render(
      <ToastProvider>
        <ToastTestHarness />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId("add-success"));
    });
    expect(screen.getByTestId("toast-count").textContent).toBe("1");

    act(() => {
      fireEvent.click(screen.getByTestId("remove-first"));
    });
    expect(screen.getByTestId("toast-count").textContent).toBe("0");
  });

  it("toast auto-removes after duration", async () => {
    jest.useFakeTimers();

    function AutoRemoveHarness() {
      const { toasts, addToast } = useToast();
      return (
        <div>
          <button onClick={() => addToast("Auto remove me", "info", 1000)} data-testid="add">
            Add
          </button>
          <span data-testid="count">{toasts.length}</span>
        </div>
      );
    }

    render(
      <ToastProvider>
        <AutoRemoveHarness />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId("add"));
    });
    expect(screen.getByTestId("count").textContent).toBe("1");

    act(() => {
      jest.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("0");
    });

    jest.useRealTimers();
  });

  it("useToast throws when used outside ToastProvider", () => {
    // Suppress expected error output
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    function BadComponent() {
      useToast();
      return null;
    }

    expect(() => render(<BadComponent />)).toThrow(
      "useToast must be used within a ToastProvider"
    );

    consoleSpy.mockRestore();
  });
});
