"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import TeamShell from "../team-shell";

type SizePreset = "small" | "medium" | "large";
type ECLevel = "L" | "M" | "Q" | "H";

const SIZE_PX: Record<SizePreset, number> = {
  small: 256,
  medium: 512,
  large: 1024,
};

// Tailwind blue-700 — matches the onboarding hero gradient navy.
const ORTHIA_NAVY = "#1d4ed8";
const DEFAULT_URL = "https://orthia.io";

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function triggerDownload(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function QrCodePage() {
  const [rawUrl, setRawUrl] = useState("");
  const [debouncedUrl, setDebouncedUrl] = useState(DEFAULT_URL);
  const [showCustomize, setShowCustomize] = useState(false);
  const [fg, setFg] = useState(ORTHIA_NAVY);
  const [bg, setBg] = useState("#ffffff");
  const [size, setSize] = useState<SizePreset>("medium");
  const [ec, setEc] = useState<ECLevel>("M");

  const svgWrapRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Debounce input → preview value (300ms). Fall back to the placeholder
  // when the field is empty so the preview is never blank.
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = rawUrl.trim();
      setDebouncedUrl(trimmed || DEFAULT_URL);
    }, 300);
    return () => clearTimeout(id);
  }, [rawUrl]);

  const trimmed = rawUrl.trim();
  const showError = trimmed !== "" && !isValidUrl(trimmed);
  // Buttons are dim but still clickable when the user has typed something
  // invalid — intentional: we always render a preview of the default URL so
  // the component is never in a "nothing to download" state.
  const downloadsDim = showError;

  const pxSize = SIZE_PX[size];

  function handleDownloadPng() {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    triggerDownload(`orthia-qr-${timestamp()}.png`, canvas.toDataURL("image/png"));
  }

  function handleDownloadSvg() {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', source], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(`orthia-qr-${timestamp()}.svg`, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <TeamShell title="QR Code">
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        {/* Preview */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div
            ref={svgWrapRef}
            className="mx-auto flex aspect-square w-full max-w-md items-center justify-center rounded-lg border border-slate-100 p-4 sm:p-6"
            style={{ backgroundColor: bg }}
          >
            <QRCodeSVG
              value={debouncedUrl}
              level={ec}
              fgColor={fg}
              bgColor={bg}
              marginSize={0}
              className="h-auto w-full max-w-full"
            />
          </div>
          <p className="mt-4 break-all text-center text-xs text-slate-500">
            Encoding: <span className="font-mono text-slate-700">{debouncedUrl}</span>
          </p>

          {/* Hidden off-screen canvas rendered at the chosen export size, used
              as the source for PNG downloads. Kept off-screen rather than
              display:none so the canvas draws correctly. */}
          <div
            ref={canvasWrapRef}
            aria-hidden
            className="pointer-events-none absolute -left-[9999px] -top-[9999px]"
          >
            <QRCodeCanvas
              value={debouncedUrl}
              size={pxSize}
              level={ec}
              fgColor={fg}
              bgColor={bg}
              marginSize={0}
            />
          </div>
        </section>

        {/* Controls */}
        <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">URL</span>
            <input
              type="text"
              value={rawUrl}
              onChange={(e) => setRawUrl(e.target.value)}
              placeholder={DEFAULT_URL}
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {showError && (
              <p className="mt-1 text-xs text-red-600">
                Enter a valid http(s) URL.
              </p>
            )}
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleDownloadPng}
              className={`flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 ${
                downloadsDim ? "opacity-40" : ""
              }`}
            >
              Download PNG
            </button>
            <button
              onClick={handleDownloadSvg}
              className={`flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 ${
                downloadsDim ? "opacity-40" : ""
              }`}
            >
              Download SVG
            </button>
          </div>

          <button
            onClick={() => setShowCustomize((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>Customize</span>
            <span className="text-slate-400">{showCustomize ? "−" : "+"}</span>
          </button>

          {showCustomize && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600">
                    Foreground
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={fg}
                      onChange={(e) => setFg(e.target.value)}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-300"
                      aria-label="Foreground color"
                    />
                    <input
                      type="text"
                      value={fg}
                      onChange={(e) => setFg(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600">
                    Background
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-300"
                      aria-label="Background color"
                    />
                    <input
                      type="text"
                      value={bg}
                      onChange={(e) => setBg(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
                    />
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="block text-xs font-medium text-slate-600">Size</span>
                <div className="mt-1 flex gap-1 rounded-lg border border-slate-300 bg-white p-1">
                  {(["small", "medium", "large"] as SizePreset[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSize(opt)}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize ${
                        size === opt
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {opt} · {SIZE_PX[opt]}px
                    </button>
                  ))}
                </div>
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-slate-600">
                  Error correction
                </span>
                <div className="mt-1 flex gap-1 rounded-lg border border-slate-300 bg-white p-1">
                  {(["L", "M", "Q", "H"] as ECLevel[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEc(opt)}
                      className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold ${
                        ec === opt
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                      title={
                        opt === "L"
                          ? "Low (~7%)"
                          : opt === "M"
                            ? "Medium (~15%)"
                            : opt === "Q"
                              ? "Quartile (~25%)"
                              : "High (~30%)"
                      }
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <span className="mt-1 block text-[11px] text-slate-400">
                  Higher = more damage-tolerant, denser QR.
                </span>
              </label>
            </div>
          )}
        </aside>
      </div>
    </TeamShell>
  );
}
