export const builtinProgramFrequencies: Record<3 | 4 | 5 | 6, string> = {
  3: "주 3회",
  4: "주 4회",
  5: "주 5회",
  6: "주 6회",
};
export const builtinProgramFrequenciesKeys: (keyof typeof builtinProgramFrequencies)[] = [3, 4, 5, 6] as const;

export const builtinProgramAges: Record<"less_than_3_months" | "3_to_12_months" | "more_than_year", string> = {
  less_than_3_months: "3개월 미만",
  "3_to_12_months": "3~12개월",
  more_than_year: "1년 이상",
};
export const builtinProgramAgesKeys: (keyof typeof builtinProgramAges)[] = [
  "less_than_3_months",
  "3_to_12_months",
  "more_than_year",
] as const;

export const builtinProgramDurations: Record<"30-45" | "45-60" | "60-90" | "90+", string> = {
  "30-45": "30~45분",
  "45-60": "45~60분",
  "60-90": "60~90분",
  "90+": "90분 이상",
};
export const builtinProgramDurationsKeys: (keyof typeof builtinProgramDurations)[] = [
  "30-45",
  "45-60",
  "60-90",
  "90+",
] as const;

export const builtinProgramGoals: Record<"strength" | "hypertrophy" | "strength_and_hypertrophy", string> = {
  strength: "근력",
  hypertrophy: "근비대",
  strength_and_hypertrophy: "근력 및 근비대",
};

export type IBuiltinProgramAge = keyof typeof builtinProgramAges;
export type IBuiltinProgramDuration = keyof typeof builtinProgramDurations;
export type IBuiltinProgramFrequency = keyof typeof builtinProgramFrequencies;
export type IBuiltinProgramGoal = keyof typeof builtinProgramGoals;
