import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import { uploadCSV } from "../utils/api";
import { useToast } from "../context/ToastContext";

interface UploadResult {
  success: boolean;
  message: string;
  rows_loaded?: number;
}

const CSV_COLUMNS = [
  "player_id", "player_name", "team", "position", "game_date",
  "at_bats", "hits", "doubles", "triples", "home_runs",
  "runs", "rbi", "strikeouts", "walks", "hit_by_pitch",
  "innings_pitched", "earned_runs", "hits_allowed",
  "walks_allowed", "strikeouts_pitched", "game_id", "opponent"
];

export default function UploadPage() {
  const { addToast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setResult({ success: false, message: "Please select a .csv file." });
      return;
    }
    setSelectedFile(file);
    setResult(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setResult(null);
    try {
      const res = await uploadCSV(selectedFile);
      setResult(res);
      if (res.success) {
        addToast(`CSV uploaded successfully! ${res.rows_loaded ?? 0} rows loaded.`, "success");
      } else {
        addToast(`Upload failed: ${res.message}`, "error");
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Upload failed. Check the backend is running.";
      setResult({ success: false, message: msg });
      addToast(`Upload failed: ${msg}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const header = CSV_COLUMNS.join(",");
    const row = "1,John Doe,Eagles,CF,2025-03-15,4,2,0,0,1,2,2,1,1,0,0,0,0,0,0,G001,Tigers";
    const content = `${header}\n${row}\n`;
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 className="page-title">Upload Data</h1>
      <p className="page-subtitle">
        Upload a CSV file to replace the current dataset
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className={`upload-area ${dragging ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleChange}
            />
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold text-sm">
              Drag & drop your CSV file here
            </p>
            <p className="text-gray-400 text-xs mt-1">or click to browse</p>
            {selectedFile && (
              <div className="mt-4 flex items-center gap-2 justify-center">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-blue-700 text-sm font-medium">
                  {selectedFile.name}
                </span>
                <span className="text-gray-400 text-xs">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            className="btn-primary"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload CSV
              </>
            )}
          </button>

          {/* Result */}
          {result && (
            <div
              className={`flex items-start gap-3 p-4 rounded-xl border ${
                result.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {result.success ? "Upload Successful!" : "Upload Failed"}
                </p>
                <p className="text-xs mt-0.5">{result.message}</p>
                {result.success && result.rows_loaded !== undefined && (
                  <p className="text-xs mt-1 font-medium">
                    {result.rows_loaded} rows loaded into the database.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">
              CSV Format Requirements
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Your CSV must include these columns (in any order):
            </p>
            <div className="space-y-1">
              {CSV_COLUMNS.map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                  <code className="text-xs text-gray-700 font-mono">{col}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">
              Download Sample Template
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Download a CSV template with all required columns.
            </p>
            <button
              className="btn-secondary text-sm"
              onClick={downloadSampleCSV}
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800 font-semibold mb-1">
              Important Notice
            </p>
            <p className="text-xs text-amber-700">
              Uploading a new CSV will replace all existing records in the
              database. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
