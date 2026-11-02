import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMeta } from "../utils/api";
import type { DateRange, Meta } from "../types";

/**
 * App-wide data context:
 *  - `meta`: teams, players and date range for filters and forms
 *  - `range`: the date filter, shared by Dashboard, Players, Pitching and Teams
 *  - `version`: bumps whenever data changes, so pages know to reload
 */
interface DataContextType {
  meta: Meta | null;
  metaError: boolean;
  range: DateRange;
  setRange: (r: DateRange) => void;
  version: number;
  dataChanged: () => void;
}

const EMPTY_RANGE: DateRange = { start: "", end: "" };

const DataContext = createContext<DataContextType>({
  meta: null,
  metaError: false,
  range: EMPTY_RANGE,
  setRange: () => {},
  version: 0,
  dataChanged: () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState(false);
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMeta()
      .then((m) => {
        if (!cancelled) {
          setMeta(m);
          setMetaError(false);
        }
      })
      .catch(() => !cancelled && setMetaError(true));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const dataChanged = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ meta, metaError, range, setRange, version, dataChanged }),
    [meta, metaError, range, version, dataChanged]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
