import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

// A 2D context that accepts every call; fillRect is counted to see frames drawn.
const fillRect = vi.fn();
function fakeContext(): CanvasRenderingContext2D {
  const ctx: Record<string | symbol, unknown> = { fillRect };
  return new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })),
    set: (t, k, v) => ((t[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(fakeContext as never);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(360);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  fillRect.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const frames = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("game loop", () => {
  it("runs a climb, pauses from the topbar, and resumes", () => {
    render(<App />);
    fireEvent.click(screen.getByText("🎮 Play"));
    fireEvent.click(screen.getByText(/Play as Boy/));
    expect(screen.getByText("🪙 0")).toBeInTheDocument();

    // Hold right and jump for a second of frames; the loop keeps drawing.
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: " " });
    frames(1000);
    expect(fillRect.mock.calls.length).toBeGreaterThan(100);

    fireEvent.click(screen.getByLabelText("Pause"));
    expect(screen.getByText("▶ Resume")).toBeInTheDocument();
    const drawn = fillRect.mock.calls.length;
    frames(1000);
    expect(fillRect.mock.calls.length).toBe(drawn);

    fireEvent.click(screen.getByText("▶ Resume"));
    frames(200);
    expect(fillRect.mock.calls.length).toBeGreaterThan(drawn);
  }, 30_000);

  it("quits to home only from the home button", () => {
    render(<App />);
    fireEvent.click(screen.getByText("🎮 Play"));
    fireEvent.click(screen.getByText(/Play as Boy/));
    fireEvent.click(screen.getByLabelText("Quit to home"));
    expect(screen.getByText("🗺️ Levels")).toBeInTheDocument();
  }, 30_000);

  it("keeps a touch button held when the finger drifts off it", () => {
    render(<App />);
    fireEvent.click(screen.getByText("🎮 Play"));
    fireEvent.click(screen.getByText(/Play as Boy/));
    const right = screen.getByLabelText("right");
    fireEvent.pointerDown(right, { pointerId: 1 });
    fireEvent.pointerLeave(right, { pointerId: 1 });
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerUp(right, { pointerId: 1 });
  }, 30_000);
});
