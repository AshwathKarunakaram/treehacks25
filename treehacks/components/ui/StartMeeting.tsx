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
    // Navigate to the meeting page, passing speaker names as query parameters.
    router.push(
      `/meeting?speaker1=${encodeURIComponent(
        speaker1
      )}&speaker2=${encodeURIComponent(speaker2)}`
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-96 bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Start Meeting</h1>
        <div className="mb-4">
          <label htmlFor="speaker1" className="block text-gray-300 mb-2">
            Speaker 1 Name
          </label>
          <input
            id="speaker1"
            type="text"
            placeholder="Enter Speaker 1 Name"
            value={speaker1}
            onChange={(e) => setSpeaker1(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded text-white focus:outline-none"
          />
        </div>
        <div className="mb-6">
          <label htmlFor="speaker2" className="block text-gray-300 mb-2">
            Speaker 2 Name
          </label>
          <input
            id="speaker2"
            type="text"
            placeholder="Enter Speaker 2 Name"
            value={speaker2}
            onChange={(e) => setSpeaker2(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded text-white focus:outline-none"
          />
        </div>
        <button
          onClick={handleStartMeeting}
          className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded"
        >
          Start Meeting
        </button>
      </div>
    </div>
  );
}
