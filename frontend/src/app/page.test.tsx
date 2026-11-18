import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("@/components/ClientOnlySchedulingsPage", () => ({
  ClientOnlySchedulingsPage: () => <p>Schedulings UI</p>,
}));

describe("Home page", () => {
  it("renders the schedulings UI inside the app shell", () => {
    render(<Home />);
    expect(screen.getByRole("banner")).toHaveTextContent("Scheduler");
    expect(screen.getByRole("main")).toHaveTextContent("Schedulings UI");
  });
});
