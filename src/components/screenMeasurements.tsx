import type { JSX } from "react";
import { IStats, ISettings, IStatsKey } from "../types";
import { IDispatch } from "../ducks/types";
import { StatsList } from "./statsList";
import { INavCommon } from "../models/state";
import { useNavOptions } from "../navigation/useNavOptions";

interface IProps {
  dispatch: IDispatch;
  settings: ISettings;
  stats: IStats;
  navCommon: INavCommon;
  initialKey?: IStatsKey;
}

export function ScreenMeasurements(props: IProps): JSX.Element {
  const { settings, stats, dispatch } = props;
  const initialKey = props.initialKey;

  useNavOptions({ navTitle: "Measurements", navHelpKey: "measurements" });

  return (
    <>
      <StatsList
        initialKey={initialKey}
        stats={stats}
        settings={settings}
        dispatch={dispatch}
      />
    </>
  );
}
