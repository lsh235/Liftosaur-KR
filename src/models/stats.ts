import { IPercentage, ISettings, IStats, IStatsHealthKey, IStatsKey, IWeight } from "../types";
import { CollectionUtils_sort, CollectionUtils_sortBy } from "../utils/collection";
import { ObjectUtils_keys } from "../utils/object";
import { Weight_add, Weight_build, Weight_divide } from "./weight";

export function Stats_name(key: IStatsKey | IStatsHealthKey): string {
  switch (key) {
    case "bicepLeft":
      return "왼쪽 이두근";
    case "bicepRight":
      return "오른쪽 이두근";
    case "calfLeft":
      return "왼쪽 종아리";
    case "calfRight":
      return "오른쪽 종아리";
    case "chest":
      return "가슴";
    case "forearmLeft":
      return "왼쪽 전완근";
    case "forearmRight":
      return "오른쪽 전완근";
    case "hips":
      return "엉덩이";
    case "neck":
      return "목";
    case "shoulders":
      return "어깨";
    case "thighLeft":
      return "왼쪽 허벅지";
    case "thighRight":
      return "오른쪽 허벅지";
    case "waist":
      return "허리";
    case "weight":
      return "체중";
    case "bodyfat":
      return "체지방률";
    case "sleep":
      return "수면";
    case "calories":
      return "칼로리";
    case "protein":
      return "단백질";
  }
}

export function Stats_getCurrentBodyweight(stats: IStats): IWeight | undefined {
  const weights = CollectionUtils_sortBy(stats.weight.weight || [], "timestamp", true);
  return weights[0]?.value;
}

export function Stats_getCurrentMovingAverageBodyweight(stats: IStats, settings: ISettings): IWeight | undefined {
  const movingAverageWindowSize = settings.graphOptions.weight?.movingAverageWindowSize;
  if (!movingAverageWindowSize) {
    return Stats_getCurrentBodyweight(stats);
  }
  const weights = CollectionUtils_sortBy(stats.weight.weight || [], "timestamp", true);
  if (weights.length < movingAverageWindowSize) {
    return Stats_getCurrentBodyweight(stats);
  }
  const recentWeights = weights.slice(0, movingAverageWindowSize);
  const totalWeight = recentWeights.reduce((sum, item) => Weight_add(sum, item.value), Weight_build(0, settings.units));
  return Weight_divide(totalWeight, recentWeights.length);
}

export function Stats_getCurrentBodyfat(stats: IStats): IPercentage | undefined {
  const weights = CollectionUtils_sortBy(stats.percentage.bodyfat || [], "timestamp", true);
  return weights[0]?.value;
}

export function Stats_insertByTimestamp<T extends { timestamp: number }>(values: T[] | undefined, value: T): T[] {
  return CollectionUtils_sort([value, ...(values || [])], (a, b) => b.timestamp - a.timestamp);
}

export function Stats_getEmpty(): IStats {
  return {
    weight: {},
    percentage: {},
    length: {},
  };
}

export function Stats_isEmpty(stats: IStats): boolean {
  const statsKeys: IStatsKey[] = [
    ...ObjectUtils_keys(stats.weight).filter((k) => (stats.weight[k] || []).length > 0),
    ...ObjectUtils_keys(stats.percentage).filter((k) => (stats.percentage[k] || []).length > 0),
    ...ObjectUtils_keys(stats.length).filter((k) => (stats.length[k] || []).length > 0),
  ];
  return statsKeys.length === 0;
}
