"use client";

import { useState } from "react";
import { AlertCircle, Info, Mic, Mic2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tag = {
  id: string;
  type: "misinformation" | "enrichment";
  content: string;
  timestamp: string;
};

export default function ZoomMeetingExtension() {
  const [activeSpeaker, setActiveSpeaker] = useState<1 | 2>(1);
  const [isResponding, setIsResponding] = useState(false);
  const [activeTag, setActiveTag] = useState<Tag | null>(null);

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
    // Simulate voice response
    setTimeout(() => setIsResponding(false), 3000);
  };

  return (
    <div
      className={`fixed right-4 top-4 bottom-4 w-96 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col transition-all duration-300 ${
        isResponding
          ? activeTag?.type === "misinformation"
            ? "ring-4 ring-red-500"
            : "ring-4 ring-green-500"
          : ""
      }`}
    >
      {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">RTMS Monitor</h2>
      </div>

      {/* Top Display Area */}
      <div className="h-64 bg-gray-800 p-4 flex items-center justify-center border-b border-gray-700">
        {isResponding ? (
          <div className="text-center">
            <div className="animate-pulse mb-2">
              {activeTag?.type === "misinformation" ? (
                <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
              ) : (
                <Info className="w-12 h-12 mx-auto text-green-500" />
              )}
            </div>
            <p className="text-sm text-gray-400">
              {activeTag?.type === "misinformation"
                ? "Correcting..."
                : "Enriching..."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            Visual content will appear here
          </p>
        )}
      </div>

      {/* Middle Panel (Tag Display Area) */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => handleTagClick(tag)}
            className={`w-full text-left p-3 rounded-md text-sm flex justify-between items-center transition-colors duration-200 ${
              tag.type === "misinformation"
                ? "bg-red-900 hover:bg-red-800 text-red-400"
                : "bg-green-900 hover:bg-green-800 text-green-400"
            }`}
          >
            <span>{tag.content}</span>
            <span className="text-xs text-gray-500">{tag.timestamp}</span>
          </button>
        ))}
      </div>

      {/* Bottom Control Area */}
      <div className="p-4 bg-gray-800 space-y-2 border-t border-gray-700">
        <div className="flex space-x-2">
          <Button
            variant={activeSpeaker === 1 ? "default" : "secondary"}
            size="sm"
            className={`flex-1 ${
              activeSpeaker === 1
                ? "bg-green-800 hover:bg-green-700"
                : "bg-gray-700"
            }`}
            onClick={() => setActiveSpeaker(1)}
          >
            <Mic className="w-4 h-4 mr-2" />
            Speaker 1
          </Button>
          <Button
            variant={activeSpeaker === 2 ? "default" : "secondary"}
            size="sm"
            className={`flex-1 ${
              activeSpeaker === 2
                ? "bg-green-800 hover:bg-green-700"
                : "bg-gray-700"
            }`}
            onClick={() => setActiveSpeaker(2)}
          >
            <Mic2 className="w-4 h-4 mr-2" />
            Speaker 2
          </Button>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="w-full bg-red-800 hover:bg-red-700"
          onClick={() => setIsResponding(false)}
        >
          <Square className="w-4 h-4 mr-2" />
          Stop/End
        </Button>
      </div>
    </div>
  );
}
