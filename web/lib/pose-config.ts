import manifest from "./poses-manifest.json";

export interface PoseDef {
  id: string;
  label: string;
  labelZh: string;
  category: string;
  url: string;
  isDefault?: boolean;
  duration?: number;  // 动画时长（秒），0 或 undefined = 单帧静态姿态
  loop?: boolean;     // 是否循环播放，默认 false
}

export const POSE_PRESETS: readonly PoseDef[] = manifest.poses.map((p) => ({
  id: p.id,
  label: p.label,
  labelZh: p.labelZh,
  category: p.category,
  url: `/models/poses/${p.filename}`,
  ...(p.isDefault ? { isDefault: true } : {}),
  ...(p.duration != null ? { duration: p.duration } : {}),
  ...(p.loop ? { loop: true } : {}),
}));

export const POSE_CATEGORIES = manifest.categories;

export function getPoseById(id: string): PoseDef | undefined {
  return POSE_PRESETS.find((pose) => pose.id === id);
}
