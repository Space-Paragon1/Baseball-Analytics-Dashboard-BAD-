import Link from "next/link";
import RecordForm from "../components/RecordForm";
import { AuthGate, PageHeader } from "../components/ui";
import { useData } from "../context/DataContext";
import { useToast } from "../context/ToastContext";
import { createRecord } from "../utils/api";

export default function AddRecordPage() {
  const { addToast } = useToast();
  const { dataChanged } = useData();

  return (
    <div>
      <PageHeader
        title="Add Record"
        subtitle="Enter one player's box-score line for one game. For a whole game played live, Game Mode is faster."
        actions={
          <Link href="/records" className="btn-secondary">
            View game log
          </Link>
        }
      />
      <AuthGate action="add records">
        <RecordForm
          submitLabel="Save record"
          resetOnSuccess
          onSubmit={async (values) => {
            const saved = await createRecord(values);
            addToast(`Saved ${saved.player_name}'s line for ${saved.game_id}.`, "success");
            dataChanged();
          }}
        />
      </AuthGate>
    </div>
  );
}
