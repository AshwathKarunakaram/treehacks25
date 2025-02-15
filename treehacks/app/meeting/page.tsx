"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Info, Mic, Mic2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tag = {
  id: string;
  type: "misinformation" | "enrichment";
  content: string;
  timestamp: string;
};

export default function ZoomMeetingExtension() {
  // Retrieve speaker names from query parameters.
  const searchParams = useSearchParams();
  const speaker1Name = searchParams.get("speaker1") || "Speaker 1";
  const speaker2Name = searchParams.get("speaker2") || "Speaker 2";

  const [activeSpeaker, setActiveSpeaker] = useState<1 | 2>(1);
  const [isResponding, setIsResponding] = useState(false);
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [progress, setProgress] = useState(0);

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

  const handleTagClick = (tag: Tag) => {
    setActiveTag(tag);
    setIsResponding(true);
    // Simulate a voice response for 3 seconds.
    setTimeout(() => setIsResponding(false), 3000);
  };

  // Update progress when responding is active.
  useEffect(() => {
    if (isResponding) {
      setProgress(0);
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(100, (elapsed / 3000) * 100);
        setProgress(percent);
        if (percent === 100) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isResponding]);

  return (
    <div
      className={`fixed right-4 top-4 bottom-4 w-[28rem] border rounded-lg overflow-hidden flex flex-col transition-all duration-500 shadow-2xl backdrop-blur-md`}
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
        <h2 className="text-sm font-bold bg-clip-text text-white" style={{}}>
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

      {/* Bottom Control Area */}
      <div
        className="p-6 space-y-3 border-t"
        style={{
          background: "rgba(20,20,20,0.9)",
          borderColor: "#444444",
        }}
      >
        <div className="flex space-x-3">
          <Button
            variant="default"
            size="sm"
            className="flex-1 py-2 transition-all"
            onClick={() => setActiveSpeaker(1)}
            style={{
              background: activeSpeaker === 1 ? "#006600" : "#222222",
            }}
          >
            <Mic className="w-5 h-5 mr-2" style={{ color: "#FFFFFF" }} />
            {speaker1Name}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 py-2 transition-all"
            onClick={() => setActiveSpeaker(2)}
            style={{
              background: activeSpeaker === 2 ? "#006600" : "#222222",
            }}
          >
            <Mic2 className="w-5 h-5 mr-2" style={{ color: "#FFFFFF" }} />
            {speaker2Name}
          </Button>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="w-full py-2 transition-all"
          onClick={() => setIsResponding(false)}
          style={{ background: "#990000" }}
        >
          <Square className="w-5 h-5 mr-2" style={{ color: "#FFFFFF" }} />
          Stop Voice Agent
        </Button>
      </div>
    </div>
  );
}
