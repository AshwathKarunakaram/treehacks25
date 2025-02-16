"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useSound from "use-sound";
import { AlertCircle, Info, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

// Define a Tag type for our transcript markers.
type Tag = {
  id: string;
  type: "misinformation" | "enrichment";
  content: string;
  timestamp: string;
};

export default function ZoomMeetingExtension() {
  // Retrieve a single speaker name from query parameters.
  const searchParams = useSearchParams();
  const speakerName = searchParams.get("speaker1") || "Speaker";

  // State to track whether the voice agent is responding,
  // the active tag (if any), and progress of the audio.
  const [isResponding, setIsResponding] = useState(false);
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<number | null>(null);

  // Load an audio clip using the useSound hook.
  // (Ensure the audio file is placed in your public/temp folder.)
  const [play, { stop, sound }] = useSound("temp/try.mp3", {
    interrupt: true,
    onend: () => {
      // When the audio finishes playing, update state and clear progress.
      setIsResponding(false);
      setProgress(100);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    },
  });

  // Sample tags for demonstration.
  const tags: Tag[] = [
    {
      id: "1",
      type: "misinformation",
      content: "Incorrect statistic",
      timestamp: "11:49:51 AM",
    },
    {
      id: "2",
      type: "enrichment",
      content: "Additional context",
      timestamp: "11:49:54 AM",
    },
    {
      id: "3",
      type: "misinformation",
      content: "Misleading claim",
      timestamp: "11:49:56 AM",
    },
  ];

  // Function to handle a tag click.
  // It stops any currently playing audio, resets progress, marks the active tag,
  // and then plays the associated audio clip.
  const handleTagClick = (tag: Tag) => {
    // Stop any currently playing audio.
    stop();
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setActiveTag(tag);
    setIsResponding(true);
    setProgress(0);

    // Play the audio clip.
    play();

    // Start an interval to update the progress bar.
    progressIntervalRef.current = window.setInterval(() => {
      if (sound && sound.playing()) {
        // Retrieve current playback time and duration from Howler.
        const currentTime = sound.seek() as number;
        const duration = sound.duration();
        const percent = (currentTime / duration) * 100;
        setProgress(percent);
      }
    }, 50);
  };

  // Function to stop the voice agent (stop current response and reset progress).
  const stopVoiceAgent = () => {
    stop();
    setIsResponding(false);
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  // Additional function to cancel the overall voice chat.
  // Here you might also clear any accumulated conversation context.
  const cancelVoiceChat = () => {
    stopVoiceAgent();
    // (Optional) Clear any conversation context here if you're maintaining one.
    // For example: contextMemory.clear();
    console.log("Voice chat canceled and context cleared.");
  };

  return (
    <div
      className="fixed right-4 top-4 bottom-4 w-[32rem] border rounded-lg overflow-hidden flex flex-col transition-all duration-500 shadow-2xl backdrop-blur-md"
      style={{
        background: "linear-gradient(135deg, #111111, #000000)",
        borderColor: "#444444",
      }}
    >
      {/* Header with Progress Bar */}
      <div
        className="p-6 border-b"
        style={{
          background: "rgba(20,20,20,0.9)",
          borderColor: "#444444",
        }}
      >
        <h2
          className="text-sm font-bold bg-clip-text text-white"
          style={{
          }}
        >
          RTMS Monitor
        </h2>
        {isResponding && (
          <div
            className="w-full h-1 mt-2 rounded overflow-hidden"
            style={{ backgroundColor: "#333333" }}
          >
            <div
              className="h-full rounded"
              style={{
                backgroundColor: "#00FFAA",
                width: `${progress}%`,
                transition: "width 0.1s ease-out",
              }}
            ></div>
          </div>
        )}
      </div>

      {/* Top Display Area */}
      <div
        className="h-64 p-6 flex items-center justify-center border-b relative overflow-hidden"
        style={{
          background: "rgba(20,20,20,0.9)",
          borderColor: "#444444",
        }}
      >
        {isResponding ? (
          <div className="relative z-10 text-center transition-opacity duration-300">
            {activeTag?.type === "misinformation" ? (
              <AlertCircle
                className="w-16 h-16 mx-auto"
                style={{ color: "#FF5555" }}
              />
            ) : (
              <Info
                className="w-16 h-16 mx-auto"
                style={{ color: "#55FF55" }}
              />
            )}
            <p
              className="text-lg font-medium mt-4"
              style={{ color: "#CCCCCC" }}
            >
              {activeTag?.type === "misinformation"
                ? "Correcting..."
                : "Enriching..."}
            </p>
          </div>
        ) : (
          <p className="text-lg font-light" style={{ color: "#CCCCCC" }}>
            Visual content will appear here
          </p>
        )}
      </div>

      {/* Middle Panel (Tag Display Area) */}
      <div className="flex-grow overflow-y-auto p-6 space-y-3">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleTagClick(tag)}
            className="w-full text-left p-4 rounded-md text-base flex justify-between items-center transition-transform duration-200 shadow-md transform hover:-translate-y-1"
            style={{
              background: tag.type === "misinformation" ? "#330000" : "#003300",
              color: tag.type === "misinformation" ? "#FF5555" : "#55FF55",
            }}
          >
            <span>{tag.content}</span>
            <span className="text-xs" style={{ color: "#AAAAAA" }}>
              {tag.timestamp}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom Control Area: Two Buttons */}
      <div
        className="p-6 space-y-3 border-t"
        style={{
          background: "rgba(20,20,20,0.9)",
          borderColor: "#444444",
        }}
      >
        {/* Cancel Response Button */}
        <Button
          variant="default"
          size="sm"
          className="w-full py-2 transition-all"
          onClick={stopVoiceAgent}
          style={{ background: "#444444" }}
        >
          <Square className="w-5 h-5 mr-2" style={{ color: "#FFFFFF" }} />
          Cancel Response
        </Button>
        {/* Cancel Voice Chat Overall */}
        <Button
          variant="destructive"
          size="sm"
          className="w-full py-2 transition-all"
          onClick={cancelVoiceChat}
          style={{ background: "#990000" }}
        >
          <Square className="w-5 h-5 mr-2" style={{ color: "#FFFFFF" }} />
          Cancel Voice Chat
        </Button>
      </div>
    </div>
  );
}
