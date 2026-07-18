import { useState } from "react";
import { API } from "@/lib/axios-client";
import { toast } from "sonner";
import type { AssignmentType } from "@/types/chat.type";

export const useAssignment = (chatId: string) => {
  const [assignments, setAssignments] = useState<AssignmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/assignment/${chatId}`);
      setAssignments(data.assignments);
    } catch {
      toast.error("Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  };

  const createAssignment = async (body: {
    title: string;
    subject: string;
    deadline: string;
  }) => {
    setCreating(true);
    try {
      const { data } = await API.post(`/assignment/${chatId}`, body);
      setAssignments((prev) => [...prev, data.assignment]);
      toast.success("Assignment created!");
    } catch {
      toast.error("Failed to create assignment");
    } finally {
      setCreating(false);
    }
  };

  const toggleComplete = async (assignmentId: string) => {
    try {
      const { data } = await API.patch(
        `/assignment/${assignmentId}/toggle`
      );
      setAssignments((prev) =>
        prev.map((a) => (a._id === assignmentId ? data.assignment : a))
      );
    } catch {
      toast.error("Failed to update assignment");
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    try {
      await API.delete(`/assignment/${assignmentId}`);
      setAssignments((prev) => prev.filter((a) => a._id !== assignmentId));
      toast.success("Assignment deleted");
    } catch {
      toast.error("Failed to delete assignment");
    }
  };

  return {
    assignments,
    loading,
    creating,
    fetchAssignments,
    createAssignment,
    toggleComplete,
    deleteAssignment,
  };
};