"use client";

import { createContext, useContext } from "react";
import type { Bone } from "three";

const SkeletonContext = createContext<Map<string, Bone> | null>(null);

export function useSkeletonContext(): Map<string, Bone> | null {
  return useContext(SkeletonContext);
}

export default SkeletonContext;
