import { useState } from "react";

let isInitialized = false;
const animations = {
  success: "https://hex.exchange/success.json",
  failed: "https://hex.exchange/error.json",
  loading: "https://hex.exchange/loading.json",
};

export const useAnimations = () => {
  useState(() => {
    if (isInitialized) return;
    isInitialized = true;
    fetch(animations.loading);
    fetch(animations.success);
    fetch(animations.failed);
  });

  return animations;
};
