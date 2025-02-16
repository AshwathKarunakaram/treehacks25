"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, Info, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Howl } from "howler";

// Define a Tag type for our transcript markers.
type Tag = {
  id: string;
  content: string;
  timestamp: string;
  s3url: string;
};

export default function ZoomMeetingExtension() {
  // S3 bucket base URL.
  const s3BucketUrl = "https://audiotreehacks.s3.us-east-1.amazonaws.com/";

  // State to track tags coming from the backend.
  const [tags, setTags] = useState<Tag[]>([]);

  // State for handling playback UI.
  const [isResponding, setIsResponding] = useState(false);
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [progress, setProgress] = useState(0);

  // Refs to store the current Howl instance and progress interval.
  const currentSoundRef = useRef<Howl | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const pingSound = new Howl({
    src: "https://audiotreehacks.s3.us-east-1.amazonaws.com/ping.mp3",
    html5: true, // enables streaming if necessary
  });


  // Set up an EventSource to listen for new tag data from the backend.
  useEffect(() => {
    const eventSource = new EventSource(
      "http://localhost:8001/api/stream-tags"
    );
    eventSource.onmessage = (e) => {
      console.log("Raw event data:", e.data);

      try {
        const data = JSON.parse(e.data);
        // Create a new tag from the incoming data.
        const newTag: Tag = {
          id: Date.now().toString(), // or a unique id from the backend
          content: data.justification, // the preview text
          timestamp: new Date().toLocaleTimeString(),
          s3url: data.s3url,
        };

        // Prepend the new tag.
        setTags((prev) => [newTag, ...prev]);
        pingSound.play();

      } catch (err) {
        console.error("Error parsing event data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Function to handle a tag click.
  const handleTagClick = (tag: Tag) => {
    // Stop any currently playing audio.
    if (currentSoundRef.current) {
      currentSoundRef.current.stop();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setActiveTag(tag);
    setIsResponding(true);
    setProgress(0);

    // Construct the audio URL using the tag's s3key.
    const audioUrl = tag.s3url;
    const sound = new Howl({
      src: [audioUrl],
      html5: true, // enables streaming large files
      onend: () => {
        setIsResponding(false);
        setProgress(100);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      },
    });
    currentSoundRef.current = sound;
    sound.play();

    // Start an interval to update the progress bar.
    progressIntervalRef.current = window.setInterval(() => {
      if (sound.playing()) {
        const currentTime = sound.seek() as number;
        const duration = sound.duration();
        const percent = (currentTime / duration) * 100;
        setProgress(percent);
      }
    }, 50);
  };

  // Function to stop playback and reset progress.
  const stopVoiceAgent = () => {
    if (currentSoundRef.current) {
      currentSoundRef.current.stop();
    }
    setIsResponding(false);
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  // Optional: Cancel the overall voice chat.
  const cancelVoiceChat = () => {
    stopVoiceAgent();
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
        <h2 className="text-sm font-bold bg-clip-text text-white">
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
        {isResponding && activeTag ? (
          <div className="relative z-10 text-center transition-opacity duration-300">
            {activeTag.type === "misinformation" ? (
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
              {activeTag.type === "misinformation"
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
        {tags.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            Waiting for new tags...
          </p>
        ) : (
          tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag)}
              className="w-full text-left p-4 rounded-md text-base flex justify-between items-center transition-transform duration-200 shadow-md transform hover:-translate-y-1"
              style={{
                background:
                  tag.type === "misinformation" ? "#330000" : "#003300",
                color: tag.type === "misinformation" ? "#FF5555" : "#55FF55",
              }}
            >
              <span>{tag.content}</span>
              <span className="text-xs" style={{ color: "#AAAAAA" }}>
                {tag.timestamp}
              </span>
            </button>
          ))
        )}
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
