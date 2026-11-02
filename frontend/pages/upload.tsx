import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { Alert, AuthGate, ConfirmDialog, PageHeader, Spinner } from "../components/ui";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { getErrorList, getErrorMessage, uploadCSV } from "../utils/api";
import type { ImportResult } from "../types";

const REQUIRED = ["player_name", "team", "position", "game_date", "game_id", "opponent"];
const OPTIONAL = [
  "player_id", "at_bats", "hits", "doubles", "triples", "home_runs", "runs", "rbi", "strikeouts", "walks",
  "hit_by_pitch", "sacrifice_flies", "innings_pitched", "earned_runs", "hits_allowed", "walks_allowed",
  "strikeouts_pitched", "home_runs_allowed", "hit_batsmen",
];

const TEMPLATE_ROWS = [
  "Jordan Lee,Eagles,CF,2025-04-01,G001,Tigers,4,2,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0",
  "Sam Ortiz,Tigers,SP,2025-04-01,G001,Eagles,0,0,0,0,0,0,0,0,0,0,0,6.1,2,5,1,7,1,0",
];

function downloadTemplate() {
  const header = [...REQUIRED, ...OPTIONAL.filter((c) => c !== "player_id")].join(",");
  const blob = new Blob([`${header}\n${TEMPLATE_ROWS.join("\n")}\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bad_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function UploadPage() {
  const { addToast } = useToast();
  const { dataChanged } = useData();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("append");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [failure, setFailure] = useState<{ message: string; errors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setResult(null);
    setFailure(null);
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setFailure({ message: "Please choose a .csv file.", errors: [] });
      return;
    }
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setConfirming(false);
    setBusy(true);
    setResult(null);
    setFailure(null);
    try {
      const res = await uploadCSV(file, mode);
      setResult(res);
      addToast(res.message, "success");
      dataChanged();
    } catch (e) {
      setFailure({ message: getErrorMessage(e, "Upload failed."), errors: getErrorList(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Upload CSV" subtitle="Load box-score data from a spreadsheet. Every row is checked before anything is saved." />
      <AuthGate admin action="upload data">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div
              className={`upload-area ${dragging ? "drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e: DragEvent<HTMLDivElement>) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files[0]);
              }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Choose a CSV file"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0])}
              />
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-slate-200 font-semibold text-sm">Drag & drop a CSV here</p>
              <p className="muted text-xs mt-1">or click to browse</p>
              {file && (
                <p className="mt-4 flex items-center gap-2 justify-center text-sm">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-blue-700 dark:text-blue-400 font-medium">{file.name}</span>
                  <span className="muted text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                </p>
              )}
            </div>

            <fieldset className="card p-4">
              <legend className="card-title float-left w-full mb-3">What should happen to existing data?</legend>
              <div className="clear-both grid sm:grid-cols-2 gap-3">
                {(
                  [
                    ["append", "Add to it", "New rows are added. A row for a player already in that game updates it."],
                    ["replace", "Replace all of it", "Deletes every existing record, then loads this file."],
                  ] as const
                ).map(([value, label, help]) => (
                  <label
                    key={value}
                    className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${
                      mode === value ? "border-blue-500 bg-blue-50 dark:bg-slate-700" : "border-gray-200 dark:border-slate-600"
                    }`}
                  >
                    <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-800 dark:text-slate-100">{label}</span>
                      <span className="block text-xs muted">{help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="btn-primary" disabled={!file || busy} onClick={() => (mode === "replace" ? setConfirming(true) : run())}>
              {busy ? <Spinner /> : <Upload className="w-4 h-4" />}
              {busy ? "Uploading..." : "Upload CSV"}
            </button>

            {result && (
              <Alert kind="success">
                <p className="font-semibold">{result.message}</p>
                {result.warnings?.map((w) => (
                  <p key={w} className="text-xs mt-1">
                    {w}
                  </p>
                ))}
              </Alert>
            )}
            {failure && (
              <Alert kind="error">
                <p className="font-semibold">{failure.message}</p>
                {failure.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs list-disc pl-4 max-h-64 overflow-y-auto">
                    {failure.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="card-title mb-2">Columns</h3>
              <p className="text-xs muted mb-3">Required (any order):</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {REQUIRED.map((c) => (
                  <code key={c} className="badge-blue font-mono">
                    {c}
                  </code>
                ))}
              </div>
              <p className="text-xs muted mb-2">Optional (blank or missing = 0):</p>
              <div className="flex flex-wrap gap-1.5">
                {OPTIONAL.map((c) => (
                  <code key={c} className="badge-gray font-mono">
                    {c}
                  </code>
                ))}
              </div>
              <p className="text-xs muted mt-3">
                Dates are YYYY-MM-DD. Innings use box-score notation (6.1 = 6⅓). Add <code>player_id</code> to tell apart
                two players with the same name.
              </p>
            </div>
            <div className="card p-5">
              <h3 className="card-title mb-2">Template</h3>
              <p className="text-xs muted mb-3">A CSV with every column and two example rows.</p>
              <button className="btn-secondary" onClick={downloadTemplate}>
                <Download className="w-4 h-4" />
                Download template
              </button>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={confirming}
          title="Replace all data?"
          message="Every existing record will be deleted and replaced with this file. If any row has a problem, nothing changes."
          confirmLabel="Replace everything"
          onConfirm={run}
          onCancel={() => setConfirming(false)}
        />
      </AuthGate>
    </div>
  );
}
