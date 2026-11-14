"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { listeningMinutes, readAloudPassages } from "@/lib/client/readAloud";
import type { BriefingResult } from "@/lib/types";
import { Icon } from "../Icon";

type PlayState = "idle" | "speaking" | "paused";

const subscribeToNothing = () => () => undefined;

function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

const BUTTON = "inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-ground";

export function ListenButton({ briefing }: { briefing: BriefingResult }) {
  const supported = useSyncExternalStore(subscribeToNothing, speechAvailable, () => false);
  const [state, setState] = useState<PlayState>("idle");
  useEffect(() => () => {
    if (speechAvailable()) {
      window.speechSynthesis.cancel();
    }
  }, []);
  if (!supported) {
    return null;
  }
  const passages = readAloudPassages(briefing);
  const start = () => {
    const speech = window.speechSynthesis;
    speech.cancel();
    passages.forEach((text, index) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = document.documentElement.lang || "en";
      if (index === passages.length - 1) {
        utterance.onend = () => setState("idle");
      }
      speech.speak(utterance);
    });
    setState("speaking");
  };
  const togglePause = () => {
    if (state === "speaking") {
      window.speechSynthesis.pause();
      setState("paused");
    } else {
      window.speechSynthesis.resume();
      setState("speaking");
    }
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setState("idle");
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-print="hide">
      {state === "idle" ? (
        <button type="button" onClick={start} className={BUTTON}>
          <Icon name="speaker" className="h-4 w-4" />
          Listen · about {listeningMinutes(passages)} min
        </button>
      ) : (
        <>
          <button type="button" onClick={togglePause} className={BUTTON}>
            <Icon name={state === "speaking" ? "pause" : "speaker"} className="h-4 w-4" />
            {state === "speaking" ? "Pause" : "Resume"}
          </button>
          <button type="button" onClick={stop} className={BUTTON}>
            <Icon name="stop" className="h-4 w-4" />
            Stop
          </button>
        </>
      )}
      <span role="status" className="sr-only">
        {state === "speaking" ? "Reading the briefing aloud." : state === "paused" ? "Paused." : ""}
      </span>
    </div>
  );
}
