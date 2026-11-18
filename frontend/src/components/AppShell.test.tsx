import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("shows the product name and renders its content in the main landmark", () => {
    render(
      <AppShell>
        <p>Page content</p>
      </AppShell>,
    );

    expect(screen.getByRole("banner")).toHaveTextContent("Scheduler");
    expect(screen.getByRole("main")).toHaveTextContent("Page content");
  });
});
