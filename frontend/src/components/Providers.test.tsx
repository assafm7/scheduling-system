import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { createQueryClient, Providers, shouldRetry } from "./Providers";

function Probe() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  return (
    <p>
      {queryClient ? "query client ready" : "no client"} / {typeof message.success === "function" ? "messages ready" : ""}
    </p>
  );
}

describe("Providers", () => {
  it("provides React Query and antd's App context to the tree", () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );
    expect(screen.getByText("query client ready / messages ready")).toBeInTheDocument();
  });

  it("never retries client errors and retries server/network errors once", () => {
    expect(shouldRetry(0, new ApiError(400, "bad"))).toBe(false);
    expect(shouldRetry(0, new ApiError(404, "missing"))).toBe(false);
    expect(shouldRetry(0, new ApiError(500, "down"))).toBe(true);
    expect(shouldRetry(0, new ApiError(0, "offline"))).toBe(true);
    expect(shouldRetry(1, new ApiError(500, "down"))).toBe(false);
  });

  it("does not retry mutations", () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
