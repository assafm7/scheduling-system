import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientOnlySchedulingsPage, PageSkeleton } from "./ClientOnlySchedulingsPage";

vi.mock("./SchedulingsPage", () => ({
  default: () => <p>Schedulings page</p>,
}));

describe("ClientOnlySchedulingsPage", () => {
  it("shows a loading skeleton", () => {
    render(<PageSkeleton />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("loads the schedulings page in the browser", async () => {
    render(<ClientOnlySchedulingsPage />);
    expect(await screen.findByText("Schedulings page")).toBeInTheDocument();
  });
});
