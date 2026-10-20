"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Home from "../page";
import "./demo.css";

interface TourStep {
  selector: string;
  title: string;
  caption: string;
  duration: number;
  align?: "top" | "bottom";
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: ".new-hero",
    title: "Live oncology signal board",
    caption:
      "One unified view of the oncology field — research papers, regulatory milestones, news, and clinical trials. The dashboard refreshes every five minutes.",
    duration: 5500,
    align: "bottom",
  },
  {
    selector: ".hero-visual",
    title: "Interactive field map",
    caption:
      "Five connected source lanes orbit a live graph core. Each node shows real-time record counts. Click any node to jump to that source.",
    duration: 5000,
    align: "bottom",
  },
  {
    selector: ".new-filter-bar",
    title: "Filter by cancer type",
    caption:
      "Track seven cancer types — lung, breast, prostate, colorectal, melanoma, leukemia, lymphoma — or view all cancers at once. Search across every source with the keyword box.",
    duration: 5000,
    align: "bottom",
  },
  {
    selector: "#overview .new-metric-grid",
    title: "Five source lanes at a glance",
    caption:
      "Each tile reports the total record count from its source API. Click a tile to open the first record in that lane. Disabled tiles indicate a source that returned an error.",
    duration: 5000,
    align: "bottom",
  },
  {
    selector: "#pulse .pulse-panel",
    title: "Activity pulse chart",
    caption:
      "A seven-day view of when records entered the field, anchored to the latest dated sample. Toggle between all lanes or isolate research, news, or editorial.",
    duration: 5000,
    align: "bottom",
  },
  {
    selector: "#pulse .coverage-panel",
    title: "Coverage map",
    caption:
      "Every lane connects to a single core. The legend below lets you click through to any source's records.",
    duration: 4500,
    align: "bottom",
  },
  {
    selector: "#signals .signal-card-grid",
    title: "Fresh signals",
    caption:
      "The six most recent records across all sources, sorted by date. Each card shows the source lane, relative date, title, and origin. Click for a full detail drawer.",
    duration: 4500,
    align: "bottom",
  },
  {
    selector: "#trial-watch .lower-grid .table-panel:first-child",
    title: "Clinical trial watch",
    caption:
      "Active registry trials with NCT IDs, recruitment status, and study timelines. When the primary source returns no trials, the board falls back to ClinicalTrials.gov automatically.",
    duration: 5000,
    align: "bottom",
  },
  {
    selector: "#trial-watch .approvals-panel",
    title: "FDA regulatory shelf",
    caption:
      "Recent oncology drug approvals with names, manufacturers, and approval dates. Click any row for the full approval record.",
    duration: 4500,
    align: "bottom",
  },
  {
    selector: ".footer-band",
    title: "Source health & API budget",
    caption:
      "The board reads through a protected server route — the API key never enters the browser. The budget meter shows remaining rate-limit quota in live mode.",
    duration: 4500,
    align: "top",
  },
];

const TOTAL_DURATION = TOUR_STEPS.reduce((sum, step) => sum + step.duration, 0);

function formatRuntime(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function DemoPage() {
  const [phase, setPhase] = useState<"intro" | "tour" | "done">("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const trackElement = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect((prev) => {
      if (
        prev &&
        prev.top === r.top &&
        prev.left === r.left &&
        prev.width === r.width &&
        prev.height === r.height
      ) {
        return prev;
      }
      return r;
    });
  }, [currentStep]);

  useEffect(() => {
    if (phase !== "tour") return;
    const loop = () => {
      trackElement();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, trackElement]);

  useEffect(() => {
    if (phase !== "tour" || !currentStep) return;
    const el = document.querySelector(currentStep.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setProgress(0);
  }, [phase, stepIndex, currentStep]);

  useEffect(() => {
    if (phase !== "tour" || !playing || !currentStep) return;
    const step = currentStep;
    const startTime = Date.now();

    const progressInterval = setInterval(() => {
      setProgress(Math.min(1, (Date.now() - startTime) / step.duration));
    }, 50);

    const advanceTimer = setTimeout(() => {
      if (stepIndex < TOUR_STEPS.length - 1) {
        setStepIndex((i) => i + 1);
      } else {
        setPhase("done");
        setPlaying(false);
      }
    }, step.duration);

    return () => {
      clearTimeout(advanceTimer);
      clearInterval(progressInterval);
    };
  }, [phase, playing, stepIndex, currentStep]);

  const startTour = useCallback(() => {
    setPhase("tour");
    setStepIndex(0);
    setPlaying(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const restartTour = useCallback(() => {
    setPhase("tour");
    setStepIndex(0);
    setPlaying(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const nextStep = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      setPhase("done");
    }
  }, [stepIndex]);

  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  const skipTour = useCallback(() => {
    setPhase("done");
    setPlaying(false);
  }, []);

  let captionStyle: React.CSSProperties = {};
  if (rect && typeof window !== "undefined") {
    const spaceBelow = window.innerHeight - rect.bottom;
    const showBelow = currentStep?.align !== "top" && spaceBelow > 220;
    const captionMaxWidth = Math.min(400, window.innerWidth - 32);
    if (showBelow) {
      captionStyle = {
        top: rect.bottom + 16,
        left: Math.max(16, Math.min(rect.left, window.innerWidth - captionMaxWidth - 16)),
        maxWidth: captionMaxWidth,
      };
    } else {
      const captionHeight = 180;
      captionStyle = {
        top: Math.max(16, rect.top - captionHeight - 16),
        left: Math.max(16, Math.min(rect.left, window.innerWidth - captionMaxWidth - 16)),
        maxWidth: captionMaxWidth,
      };
    }
  }

  let spotlightStyle: React.CSSProperties = {};
  if (rect) {
    spotlightStyle = {
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16,
    };
  }

  return (
    <>
      <div className="demo-content-wrapper">
        <Home />
      </div>

      {phase === "intro" && (
        <div className="demo-overlay-screen">
          <div className="demo-overlay-card">
            <span className="demo-overlay-kicker">Guided walkthrough</span>
            <h1>See the board in action</h1>
            <p>
              This auto-playing tour highlights every feature of the oncology
              signal dashboard — from the interactive field map to the clinical
              trial watch. Pause anytime to explore on your own.
            </p>
            <div className="demo-overlay-stats">
              <span>
                <strong>{TOUR_STEPS.length}</strong>
                <small>stops</small>
              </span>
              <span>
                <strong>{formatRuntime(TOTAL_DURATION)}</strong>
                <small>runtime</small>
              </span>
              <span>
                <strong>5</strong>
                <small>source lanes</small>
              </span>
            </div>
            <button
              className="demo-primary-btn"
              onClick={startTour}
              type="button"
            >
              Start the tour
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h13" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
            <a className="demo-secondary-link" href="/">
              Go to the live board instead
            </a>
          </div>
        </div>
      )}

      {phase === "tour" && rect && (
        <>
          <div className="demo-pointer-block" />
          <div className="demo-spotlight" style={spotlightStyle} />
          <div className="demo-caption" style={captionStyle}>
            <div className="demo-caption-header">
              <span className="demo-step-counter">
                {String(stepIndex + 1).padStart(2, "0")} /{" "}
                {String(TOUR_STEPS.length).padStart(2, "0")}
              </span>
              <span className="demo-step-title">{currentStep?.title}</span>
            </div>
            <p className="demo-caption-text">{currentStep?.caption}</p>
            <div className="demo-progress-track">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="demo-tour-controls">
              <button
                onClick={prevStep}
                disabled={stepIndex === 0}
                type="button"
                aria-label="Previous step"
                className="demo-ctrl-btn"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={togglePlay}
                type="button"
                aria-label={playing ? "Pause tour" : "Play tour"}
                className="demo-ctrl-btn demo-play-btn"
              >
                {playing ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              <button
                onClick={nextStep}
                disabled={stepIndex === TOUR_STEPS.length - 1}
                type="button"
                aria-label="Next step"
                className="demo-ctrl-btn"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              <span className="demo-ctrl-divider" />
              <button
                onClick={skipTour}
                type="button"
                className="demo-skip-btn"
              >
                End tour
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "done" && (
        <div className="demo-overlay-screen">
          <div className="demo-overlay-card">
            <span className="demo-overlay-kicker">Tour complete</span>
            <h1>The board is yours to explore</h1>
            <p>
              You&apos;ve seen every feature. Now dive in — filter by cancer
              type, click through signal cards, and open the detail drawer on any
              record.
            </p>
            <div className="demo-overlay-actions">
              <button
                className="demo-secondary-btn"
                onClick={restartTour}
                type="button"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 11a8 8 0 0 0-14.8-4L3 9" />
                  <path d="M3 4v5h5" />
                  <path d="M4 13a8 8 0 0 0 14.8 4L21 15" />
                  <path d="M21 20v-5h-5" />
                </svg>
                Replay the tour
              </button>
              <a className="demo-primary-link" href="/">
                Explore the live board
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h13" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
