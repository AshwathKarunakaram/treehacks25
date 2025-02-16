// components/AudioButton.js
import React from "react";

const AudioButton = () => {
  const playAudio = () => {
    const audio = new Audio("./try.mp3");
    audio.play();
  };

  return <button onClick={playAudio}>Play Audio</button>;
};

export default AudioButton;
