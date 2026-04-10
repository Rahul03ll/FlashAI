"use client";

import { useEffect } from "react";

export default function DbWarmup() {
  useEffect(() => {
    fetch('/api/ping').catch(() => {});
  }, []);
  return null;
}

