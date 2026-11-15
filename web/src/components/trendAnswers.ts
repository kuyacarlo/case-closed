import type { LayerCell } from "../data";
import { formatP } from "../format";
import type { VariableInfo } from "../types";

function signed(x: number, d: number): string {
  return `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
}

/** The four questions a data detective asks, answered for one square. */
export function trendAnswers(c: LayerCell, info: VariableInfo, lastYear: number) {
  const d = info.digits;
  const noun = c.dir === "rising" ? "rise" : c.dir === "falling" ? "fall" : "change";
  const trend =
    c.dir === "flat"
      ? "Essentially flat"
      : c.sig
        ? `Yes, ${c.dir}`
        : `A slight ${noun}`;
  const howMuch = `${signed(c.sen, d)} ${info.units} per decade · about ${signed(c.total, d)} ${info.units} since ${c.first_year}`;
  const significant =
    c.state === "too_short" ? "Too short to judge" : c.sig ? `Yes (p = ${formatP(c.p)})` : `Not yet (p = ${formatP(c.p)})`;
  const sure =
    c.state === "step" && c.cp
      ? `Significant, but most of it came as one jump around ${c.cp}, then stayed level.`
      : c.sig
        ? "A trend this strong would turn up by chance less than 5 times in 100."
        : c.dir === "flat"
          ? "Nothing to separate from natural ups and downs."
          : `Natural ups and downs could draw this line. ${lastYear - c.first_year + 1} years isn’t enough to be sure; a longer record would settle it.`;
  return { trend, howMuch, significant, sure };
}

