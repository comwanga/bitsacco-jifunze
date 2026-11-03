"use client";

// Lazy wrappers: the lab code only downloads on lessons that contain an exercise.
import dynamic from "next/dynamic";

export const LazyExerciseRunner = dynamic(() => import("./ExerciseRunner").then((m) => m.ExerciseRunner));
export const LazyLabBar = dynamic(() => import("./LabBar").then((m) => m.LabBar));
