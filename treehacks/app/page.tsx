"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartMeeting() {
  const [speaker1, setSpeaker1] = useState("");
  const [speaker2, setSpeaker2] = useState("");
  const router = useRouter();

  const handleStartMeeting = () => {
    if (!speaker1.trim() || !speaker2.trim()) {
      alert("Please enter names for both speakers.");
      return;
    }
    router.push(
      `/meeting?speaker1=${encodeURIComponent(
        speaker1
      )}&speaker2=${encodeURIComponent(speaker2)}`
    );
  };

  return (
    <div
      className="fixed right-4 top-4 bottom-4 w-[28rem] border rounded-lg overflow-hidden flex flex-col transition-all duration-500 shadow-2xl backdrop-blur-md"
      style={{
        background: "linear-gradient(135deg, #111111, #000000)",
        borderColor: "#444444",
      }}
    >
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-white">
          Information
        </h1>
        <div className="mb-6">
          <label
            htmlFor="speaker1"
            className="block text-sm font-medium mb-2"
            style={{ color: "#CCCCCC" }}
          >
            Speaker 1 Name
          </label>
          <input
            id="speaker1"
            type="text"
            placeholder="Enter Speaker 1 Name"
            value={speaker1}
            onChange={(e) => setSpeaker1(e.target.value)}
            className="w-full px-4 py-2 rounded-lg focus:outline-none transition"
            style={{
              background: "rgba(20,20,20,0.9)",
              border: "1px solid #444444",
              color: "#FFFFFF",
            }}
          />
        </div>
        <div className="mb-8">
          <label
            htmlFor="speaker2"
            className="block text-sm font-medium mb-2"
            style={{ color: "#CCCCCC" }}
          >
            Speaker 2 Name
          </label>
          <input
            id="speaker2"
            type="text"
            placeholder="Enter Speaker 2 Name"
            value={speaker2}
            onChange={(e) => setSpeaker2(e.target.value)}
            className="w-full px-4 py-2 rounded-lg focus:outline-none transition"
            style={{
              background: "rgba(20,20,20,0.9)",
              border: "1px solid #444444",
              color: "#FFFFFF",
            }}
          />
        </div>
        <button
          onClick={handleStartMeeting}
          className="w-full py-3 rounded-lg shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          style={{
            background: "#00FFAA",
            color: "#000000",
          }}
        >
          Start Meeting
        </button>
      </div>
    </div>
  );
}
