import { useEffect, useState } from "react";
import { useAssignment } from "@/hooks/use-assignment";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ClipboardList,
  BookOpen,
  Calendar,
} from "lucide-react";
import { Spinner } from "../ui/spinner";

interface Props {
  chatId: string;
  onClose: () => void;
}

const SUBJECTS = [
  "Maths", "Physics", "Chemistry", "Biology",
  "Computer Science", "English", "History",
  "Economics", "Other",
];

const getDeadlineColor = (deadline: string) => {
  const date = new Date(deadline);
  if (isPast(date) && !isToday(date)) return "text-red-500";
  if (isToday(date)) return "text-orange-500";
  if (isTomorrow(date)) return "text-yellow-500";
  return "text-green-500";
};

const getDeadlineLabel = (deadline: string) => {
  const date = new Date(deadline);
  if (isPast(date) && !isToday(date)) return "Overdue!";
  if (isToday(date)) return "Due Today!";
  if (isTomorrow(date)) return "Due Tomorrow";
  return format(date, "dd MMM yyyy");
};

const AssignmentTracker = ({ chatId, onClose }: Props) => {
  const { user } = useAuth();
  const {
    assignments,
    loading,
    creating,
    fetchAssignments,
    createAssignment,
    toggleComplete,
    deleteAssignment,
  } = useAssignment(chatId);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    fetchAssignments();
  }, [chatId]);

  const handleCreate = async () => {
    if (!title.trim() || !deadline) return;
    await createAssignment({ title, subject, deadline });
    setTitle("");
    setDeadline("");
    setSubject(SUBJECTS[0]);
    setShowForm(false);
  };

  const pendingAssignments = assignments.filter(
    (a) => !a.completedBy.some((u) => u._id === user?._id)
  );
  const completedAssignments = assignments.filter((a) =>
    a.completedBy.some((u) => u._id === user?._id)
  );

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-80 h-screen bg-card border-l border-border shadow-2xl flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-primary shrink-0">
          <button onClick={onClose} className="text-primary-foreground hover:opacity-70">
            <X size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <ClipboardList size={18} className="text-primary-foreground" />
            <h2 className="font-semibold text-primary-foreground text-sm">
              Assignment Tracker
            </h2>
          </div>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="text-primary-foreground hover:opacity-70 transition"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Add Assignment Form */}
        {showForm && (
          <div className="px-4 py-4 border-b border-border bg-muted/30 space-y-3">
            <h3 className="text-sm font-semibold">Add Assignment</h3>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Assignment title..."
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            />

            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Deadline</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 text-xs rounded-lg border border-border hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim() || !deadline}
                className="flex-1 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-60"
              >
                {creating ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner className="w-6 h-6" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <ClipboardList size={40} className="opacity-30" />
              <p className="text-sm">No assignments yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-xs text-primary hover:underline"
              >
                + Add first assignment
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Pending */}
              {pendingAssignments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Pending ({pendingAssignments.length})
                  </p>
                  <div className="space-y-2">
                    {pendingAssignments.map((a) => (
                      <div
                        key={a._id}
                        className="bg-background border border-border rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleComplete(a._id)}
                            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition"
                          >
                            <Circle size={18} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <BookOpen size={11} />
                                {a.subject}
                              </span>
                              <span className={cn("flex items-center gap-1 text-xs font-medium", getDeadlineColor(a.deadline))}>
                                <Calendar size={11} />
                                {getDeadlineLabel(a.deadline)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              By {a.createdBy.name} •{" "}
                              {a.completedBy.length} done
                            </p>
                          </div>
                          {a.createdBy._id === user?._id && (
                            <button
                              onClick={() => deleteAssignment(a._id)}
                              className="shrink-0 text-muted-foreground hover:text-destructive transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {completedAssignments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Completed ✅ ({completedAssignments.length})
                  </p>
                  <div className="space-y-2">
                    {completedAssignments.map((a) => (
                      <div
                        key={a._id}
                        className="bg-muted/30 border border-border rounded-xl p-3 opacity-70"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleComplete(a._id)}
                            className="mt-0.5 shrink-0 text-primary"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-through truncate">
                              {a.title}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {a.subject}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentTracker;