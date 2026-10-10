import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AnimationMixer,
  AnimationClip,
  LoopOnce,
  LoopRepeat,
  Object3D,
  AnimationAction,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getPoseById } from "../pose-config";

const CROSSFADE_DURATION = 0.5;

/**
 * Body joints (SMPL-X indices 0-21) that should be affected by pose animation.
 * Hand joints (22-51) and face joints (52-54) are excluded to preserve their
 * rest-pose rotations from the avatar model and prevent distortion.
 */
const POSE_BODY_JOINTS = new Set([
  "pelvis", "left_hip", "right_hip", "spine1", "left_knee", "right_knee",
  "spine2", "left_ankle", "right_ankle", "spine3", "left_foot", "right_foot",
  "neck", "left_collar", "right_collar", "head",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist",
]);

/**
 * Filter an AnimationClip to only include tracks for body joints.
 * Track names follow the format `boneName.quaternion`.
 */
function filterClipToBodyJoints(clip: AnimationClip): AnimationClip {
  const filteredTracks = clip.tracks.filter((track) => {
    const boneName = track.name.split(".")[0];
    return POSE_BODY_JOINTS.has(boneName);
  });
  return new AnimationClip(clip.name, clip.duration, filteredTracks);
}

export function usePoseAnimation(
  rootRef: React.RefObject<Object3D | null>,
  poseId: string | null
): { isLoading: boolean; error: string | null } {
  const mixerRef = useRef<AnimationMixer | null>(null);
  const mixerRootRef = useRef<Object3D | null>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const currentClipRef = useRef<AnimationClip | null>(null);
  // Outcome of the last finished load, tagged with the pose it belongs to: a pose
  // switch then reads as "loading" by derivation, with no reset to setState.
  const [settled, setSettled] = useState<{ poseId: string; error: string | null } | null>(
    null
  );

  useEffect(() => {
    if (!poseId) return;

    const poseDef = getPoseById(poseId);
    // An unknown pose never loads; its error is derived from poseId below.
    if (!poseDef) return;

    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;
    const loader = new GLTFLoader();

    loader.load(
      poseDef.url,
      (gltf) => {
        if (cancelled) return;

        const sourceClip = gltf.animations[0];
        if (!sourceClip) {
          setSettled({ poseId, error: `Pose "${poseDef.label}" has no animation data` });
          return;
        }

        const clip = filterClipToBodyJoints(sourceClip);

        if (clip.tracks.length === 0) {
          setSettled({ poseId, error: `Pose "${poseDef.label}" has no body joint tracks` });
          return;
        }

        // If the mixer is bound to a stale root (avatar GLB reloaded), discard it
        if (mixerRef.current && mixerRootRef.current !== root) {
          mixerRef.current.stopAllAction();
          mixerRef.current.uncacheRoot(mixerRootRef.current!);
          mixerRef.current = null;
          currentActionRef.current = null;
          currentClipRef.current = null;
        }

        if (!mixerRef.current) {
          mixerRef.current = new AnimationMixer(root);
          mixerRootRef.current = root;
        }
        const mixer = mixerRef.current;

        // Evict the previous clip (and its cached action) from the mixer
        if (currentClipRef.current) {
          mixer.uncacheClip(currentClipRef.current);
        }

        const newAction = mixer.clipAction(clip);
        currentClipRef.current = clip;

        const duration = poseDef.duration;
        const isStaticPose = !duration || duration <= 0;

        if (isStaticPose) {
          newAction.clampWhenFinished = true;
          newAction.setLoop(LoopOnce, 1);
        } else {
          newAction.setLoop(poseDef.loop ? LoopRepeat : LoopOnce, poseDef.loop ? Infinity : 1);
          if (!poseDef.loop) {
            newAction.clampWhenFinished = true;
          }
        }

        const existingAction = currentActionRef.current;
        if (existingAction && existingAction !== newAction) {
          newAction.reset();
          newAction.play();
          existingAction.crossFadeTo(newAction, CROSSFADE_DURATION, true);
        } else {
          newAction.reset();
          newAction.play();
        }

        // Jump static poses to their final frame immediately to avoid first-frame flicker
        if (isStaticPose) {
          newAction.time = clip.duration;
          mixer.update(0);
        }

        currentActionRef.current = newAction;
        setSettled({ poseId, error: null });
      },
      undefined,
      () => {
        if (cancelled) return;
        setSettled({ poseId, error: `Failed to load pose "${poseDef.label}"` });
      }
    );

    return () => {
      cancelled = true;
      const mixer = mixerRef.current;
      if (mixer) {
        mixer.stopAllAction();
        if (mixerRootRef.current) {
          mixer.uncacheRoot(mixerRootRef.current);
        }
        mixerRef.current = null;
        mixerRootRef.current = null;
        currentActionRef.current = null;
        currentClipRef.current = null;
      }
    };
  }, [poseId]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  const poseDef = poseId ? getPoseById(poseId) : null;
  const outcome = settled?.poseId === poseId ? settled : null;

  return {
    isLoading: Boolean(poseDef) && outcome === null,
    error: poseId && !poseDef ? `Unknown pose: ${poseId}` : (outcome?.error ?? null),
  };
}
