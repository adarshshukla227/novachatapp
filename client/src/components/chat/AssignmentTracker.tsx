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
  Calendar,
  Flag,
} from "lucide-react";
import { Spinner } from "../ui/spinner";

interface Props {
  chatId: string;
  onClose: () => void;
}

const CATEGORIES = [
  "Assignment", "Project", "Meeting", "Exam", "Event", "Other",
];

const PRIORITIES = [
  { label: "High", color: "text-red-500 bg-red-50 dark:bg-red-950/30 border-red-200" },
  { label: "Medium", color: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200" },
  { label: "Low", color: "text-green-500 bg-green-50 dark:bg-green-950/30 border-green-200" },
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
  return format(date, "dd MMM, hh:mm a");
};

const getPriorityStyle = (priority: string) => {
  return PRIORITIES.find((p) => p.label === priority)?.color ||
    "text-gray-500 bg-gray-50 border-gray-200";
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
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState("Medium");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    fetchAssignments();
  }, [chatId]);

  const handleCreate = async () => {
    if (!title.trim() || !deadline) return;
    await createAssignment({
      title: title.trim(),
      subject: `${subject} • ${priority}`,
      deadline,
    });
    setTitle("");
    setDescription("");
    setDeadline("");
    setSubject(CATEGORIES[0]);
    setPriority("Medium");
    setShowForm(false);
  };

  const pendingTasks = assignments.filter(
    (a) => !a.completedBy.some((u) => u._id === user?._id)
  );
  const completedTasks = assignments.filter((a) =>
    a.completedBy.some((u) => u._id === user?._id)
  );

  const parseSubjectPriority = (raw: string) => {
    const parts = raw.split(" • ");
    return { category: parts[0] || raw, priority: parts[1] || "Medium" };
  };

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
              Task Board
            </h2>
          </div>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="text-primary-foreground hover:opacity-70 transition"
            title="Add Task"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
          <span className="text-xs text-muted-foreground">
            🔥 <span className="font-semibold text-foreground">{pendingTasks.length}</span> pending
          </span>
          <span className="text-xs text-muted-foreground">
            ✅ <span className="font-semibold text-foreground">{completedTasks.length}</span> done
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {assignments.length} total
          </span>
        </div>

        {/* Add Task Form */}
        {showForm && (
          <div className="px-4 py-4 border-b border-border bg-muted/30 space-y-3 shrink-0">
            <h3 className="text-sm font-semibold">➕ New Task</h3>

            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            />

            {/* Description */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)..."
              rows={2}
              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />

            {/* Category + Priority row */}
            <div className="flex gap-2">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="flex-1 text-sm bg-background border border-border rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex-1 text-sm bg-background border border-border rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.label} value={p.label}>{p.label} Priority</option>
                ))}
              </select>
            </div>

            {/* Deadline */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar size={11} /> Deadline
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setTitle(""); setDescription(""); setDeadline(""); }}
                className="flex-1 py-2 text-xs rounded-lg border border-border hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim() || !deadline}
                className="flex-1 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-60"
              >
                {creating ? "Adding..." : "Add Task"}
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
              <p className="text-sm font-medium">No tasks yet</p>
              <p className="text-xs text-center px-6 opacity-70">
                Add tasks with deadlines so everyone in the group stays on track
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-1 px-4 py-2 text-xs rounded-full bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                + Add First Task
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-5">

              {/* Pending Tasks */}
              {pendingTasks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Pending ({pendingTasks.length})
                  </p>
                  <div className="space-y-2">
                    {pendingTasks.map((a) => {
                      const { category, priority: prio } = parseSubjectPriority(a.subject);
                      return (
                        <div
                          key={a._id}
                          className="bg-background border border-border rounded-xl p-3 space-y-2 hover:shadow-sm transition"
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleComplete(a._id)}
                              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition"
                            >
                              <Circle size={17} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{a.title}</p>

                              {/* Category + Priority badges */}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                  {category}
                                </span>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 font-medium",
                                  getPriorityStyle(prio)
                                )}>
                                  <Flag size={9} />
                                  {prio}
                                </span>
                              </div>

                              {/* Deadline */}
                              <span className={cn(
                                "flex items-center gap-1 text-xs font-medium mt-1.5",
                                getDeadlineColor(a.deadline)
                              )}>
                                <Calendar size={10} />
                                {getDeadlineLabel(a.deadline)}
                              </span>

                              {/* Creator + done count */}
                              <p className="text-xs text-muted-foreground mt-1">
                                By {a.createdBy.name} • {a.completedBy.length} done
                              </p>
                            </div>

                            {a.createdBy._id === user?._id && (
                              <button
                                onClick={() => deleteAssignment(a._id)}
                                className="shrink-0 text-muted-foreground hover:text-destructive transition mt-0.5"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Completed ✅ ({completedTasks.length})
                  </p>
                  <div className="space-y-2">
                    {completedTasks.map((a) => {
                      const { category } = parseSubjectPriority(a.subject);
                      return (
                        <div
                          key={a._id}
                          className="bg-muted/20 border border-border rounded-xl p-3 opacity-60"
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleComplete(a._id)}
                              className="mt-0.5 shrink-0 text-primary"
                            >
                              <CheckCircle2 size={17} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-through truncate">
                                {a.title}
                              </p>
                              <span className="text-xs text-muted-foreground">{category}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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