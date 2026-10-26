// Each module owns one seed file and only adds collections it uses.
// Collections are exposed at /api/<name> and via useCollection("<name>").
import type { Row } from "./types";
import { core } from "./core";
import { dashboard } from "./dashboard";
import { admissions } from "./admissions";
import { exams } from "./exams";
import { fees } from "./fees";
import { comms } from "./comms";
import { settings } from "./settings";
import { ops } from "./ops";
import { demo } from "./demo";

export type Seed = Record<string, Row[]>;
export const seed: Seed = { ...core, ...dashboard, ...admissions, ...exams, ...fees, ...comms, ...settings, ...ops, ...demo };
