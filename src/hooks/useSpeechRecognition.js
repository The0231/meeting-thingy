"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser speech-to-text via the Web Speech API (SpeechRecognition).
 * No cloud service or API key — runs entirely in the browser.
 *
 * Behavior: TAP to start, then it keeps listening across pauses and
 * accumulates everything you say. TAP AGAIN to stop and send the whole
 * message. Voice is purely additive — it never blocks typing/sending.
 *
 * Support: Chrome/Edge (full), Safari (partial, via webkitSpeechRecognition),
 * Firefox (none). `supported` is false where unavailable.
 *
 * Usage:
 *   const { supported, listening, interim, error, start, stop, toggle } =
 *     useSpeechRecognition({ onFinal: (text) => ... });
 */
export function useSpeechRecognition({ onFinal, lang = "en-US" } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState(""); // live in-progress text (accumulated + interim)
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const wantRef = useRef(false); // user wants to keep listening (until they tap again)
  const discardRef = useRef(false); // true => on stop, throw the message away instead of sending
  const finalRef = useRef(""); // accumulated finalized text across pauses
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    let rec;
    try {
      rec = new SR();
    } catch {
      setSupported(false);
      return;
    }
    setSupported(true);

    rec.continuous = true; // keep listening across pauses
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalRef.current = (finalRef.current + " " + transcript).trim();
        } else {
          interimText += transcript;
        }
      }
      setInterim((finalRef.current + " " + interimText).trim());
    };

    rec.onerror = (e) => {
      const code = e && e.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone access is blocked. Allow it via the address-bar permissions, then try again.");
        wantRef.current = false;
      } else if (code === "network") {
        setError("Voice recognition needs a network connection and couldn't reach the speech service.");
        wantRef.current = false;
      } else if (code && code !== "no-speech" && code !== "aborted") {
        setError("Voice input error: " + code + ". You can type instead.");
      }
      // benign codes (no-speech/aborted): let onend decide whether to restart
    };

    rec.onend = () => {
      // If the user still wants to listen (hasn't tapped to stop), the engine
      // just timed out on silence — restart it so we keep going until they tap.
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          setTimeout(() => {
            if (wantRef.current) {
              try {
                rec.start();
              } catch {
                /* give up quietly */
              }
            }
          }, 250);
        }
        return;
      }
      // User tapped to stop: finalize and (unless cancelled) send the message.
      setListening(false);
      const discard = discardRef.current;
      discardRef.current = false;
      const full = finalRef.current.trim();
      finalRef.current = "";
      setInterim("");
      if (!discard && full && onFinalRef.current) onFinalRef.current(full);
    };

    recRef.current = rec;
    return () => {
      wantRef.current = false;
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || wantRef.current) return;
    setError(null);
    setInterim("");
    finalRef.current = "";
    discardRef.current = false;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wantRef.current = false;
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    wantRef.current = false; // tells onend to finalize + send
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, []);

  // Stop listening and THROW AWAY the message (don't send it).
  const cancel = useCallback(() => {
    const rec = recRef.current;
    discardRef.current = true;
    wantRef.current = false;
    finalRef.current = "";
    setInterim("");
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  // Clear what's been captured so far but keep listening (start the message over).
  const restart = useCallback(() => {
    finalRef.current = "";
    setInterim("");
    if (!wantRef.current) start();
  }, [start]);

  const toggle = useCallback(() => {
    if (wantRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, interim, error, start, stop, cancel, restart, toggle };
}
