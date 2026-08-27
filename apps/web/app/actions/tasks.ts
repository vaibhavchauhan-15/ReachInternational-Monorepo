"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  verifyTaskSchema,
  taskCommentSchema,
  type CreateTaskInput,
} from "@reachinternational/validation";

export async function createTask(input: CreateTaskInput) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized access" };
    }

    const validated = createTaskSchema.parse(input);
    const supabase = createSupabaseAdminClient();

    // 1. Insert main task record
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: validated.title,
        description: validated.description || null,
        due_date: validated.due_date,
        due_time: validated.due_time || null,
        priority: validated.priority,
        reminder_offset: validated.reminder_offset,
        created_by: currentUser.id,
        status: "pending",
      })
      .select("id, task_no")
      .single();

    if (taskError || !task) {
      console.error("[Action] Task creation error:", taskError);
      return { success: false, error: taskError?.message || "Failed to create task" };
    }

    // 2. Insert task assignees
    const assigneeRows = validated.assignee_ids.map((userId) => ({
      task_id: task.id,
      user_id: userId,
      assigned_by: currentUser.id,
    }));

    const { error: assigneeError } = await supabase
      .from("task_assignees")
      .insert(assigneeRows);

    if (assigneeError) {
      console.error("[Action] Error assigning task users:", assigneeError);
    }

    // 3. Record Activity Audit Log
    await supabase.from("task_activity_logs").insert({
      task_id: task.id,
      actor_id: currentUser.id,
      action: "created",
      details: {
        title: validated.title,
        assignee_count: validated.assignee_ids.length,
        due_date: validated.due_date,
        priority: validated.priority,
      },
    });

    // 4. Send Notifications to Assignees
    if (validated.assignee_ids && validated.assignee_ids.length > 0) {
      const taskNotifications = validated.assignee_ids.map((assigneeId) => ({
        user_id: assigneeId,
        type: "task_assigned",
        title: `New Task Assigned: ${validated.title}`,
        message: `Task #${task.task_no} (${validated.title}) has been assigned to you by ${currentUser.full_name}. Due: ${validated.due_date}`,
        metadata: { task_id: task.id, task_no: task.task_no },
        channel: "in_app",
      }));
      await supabase.from("notifications").insert(taskNotifications);
    }

    revalidatePath("/tasks");
    revalidatePath("/my-work");
    revalidateTag(CACHE_TAGS.dashboard || "dashboard", "max");

    return { success: true, taskId: task.id, taskNo: task.task_no };
  } catch (err: any) {
    console.error("[Action] Unexpected error creating task:", err);
    return { success: false, error: err.message || "Failed to create task" };
  }
}

export async function updateTask(taskId: string, input: Partial<CreateTaskInput>) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized access" };
    }

    const supabase = createSupabaseAdminClient();

    const updatePayload: Record<string, any> = {};
    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.due_date !== undefined) updatePayload.due_date = input.due_date;
    if (input.due_time !== undefined) updatePayload.due_time = input.due_time;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.reminder_offset !== undefined) updatePayload.reminder_offset = input.reminder_offset;

    const { error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", taskId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Update assignees if provided
    if (input.assignee_ids && input.assignee_ids.length > 0) {
      await supabase.from("task_assignees").delete().eq("task_id", taskId);
      const assigneeRows = input.assignee_ids.map((userId) => ({
        task_id: taskId,
        user_id: userId,
        assigned_by: currentUser.id,
      }));
      await supabase.from("task_assignees").insert(assigneeRows);
    }

    await supabase.from("task_activity_logs").insert({
      task_id: taskId,
      actor_id: currentUser.id,
      action: "updated",
      details: updatePayload,
    });

    revalidatePath("/tasks");
    revalidatePath("/my-work");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update task" };
  }
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: "pending" | "in_progress" | "completed" | "overdue" | "cancelled" | "reopened",
  notes?: string,
  proofUrls?: string[]
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized access" };
    }

    const supabase = createSupabaseAdminClient();

    const updatePayload: Record<string, any> = {
      status: newStatus,
    };

    if (newStatus === "completed") {
      updatePayload.completed_by = currentUser.id;
      updatePayload.completed_at = new Date().toISOString();
      if (notes) updatePayload.completion_notes = notes;
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select("id, task_no, title, created_by")
      .single();

    if (error || !task) {
      return { success: false, error: error?.message || "Failed to update task status" };
    }

    // Upload completion proof URLs if present
    if (newStatus === "completed" && proofUrls && proofUrls.length > 0) {
      const attachmentRows = proofUrls.map((url) => ({
        task_id: taskId,
        file_name: `Completion_Proof_${Date.now()}.jpg`,
        file_url: url,
        file_type: "completion_proof",
        uploaded_by: currentUser.id,
      }));
      await supabase.from("task_attachments").insert(attachmentRows);
    }

    // Log Activity
    await supabase.from("task_activity_logs").insert({
      task_id: taskId,
      actor_id: currentUser.id,
      action: `status_changed_to_${newStatus}`,
      details: { new_status: newStatus, notes },
    });

    // Notify task manager / creator when completed
    if (newStatus === "completed" && task.created_by !== currentUser.id) {
      await supabase.from("notifications").insert({
        user_id: task.created_by,
        type: "task_completed",
        title: `Task Marked Completed: ${task.title}`,
        message: `${currentUser.full_name} completed task #${task.task_no} (${task.title}). Verification pending.`,
        metadata: { task_id: taskId, task_no: task.task_no },
        channel: "in_app",
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/my-work");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update status" };
  }
}

export async function verifyTask(taskId: string, decision: "verify" | "reopen", reason?: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized access" };
    }

    const supabase = createSupabaseAdminClient();
    const isReopen = decision === "reopen";

    const updatePayload: Record<string, any> = isReopen
      ? {
          status: "reopened",
          reopened_by: currentUser.id,
          reopened_at: new Date().toISOString(),
          reopen_reason: reason || "Manager requested revision",
        }
      : {
          verified_by: currentUser.id,
          verified_at: new Date().toISOString(),
        };

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", taskId)
      .select("id, task_no, title, completed_by")
      .single();

    if (error || !task) {
      return { success: false, error: error?.message || "Verification failed" };
    }

    await supabase.from("task_activity_logs").insert({
      task_id: taskId,
      actor_id: currentUser.id,
      action: isReopen ? "reopened" : "verified",
      details: { decision, reason },
    });

    // Notify completion author if reopened
    if (task.completed_by) {
      await supabase.from("notifications").insert({
        user_id: task.completed_by,
        type: "task_reopened",
        title: isReopen ? `Task Reopened: ${task.title}` : `Task Verified & Approved: ${task.title}`,
        message: isReopen
          ? `Manager ${currentUser.full_name} reopened task #${task.task_no}. Reason: ${reason || 'Needs revision'}`
          : `Manager ${currentUser.full_name} verified task #${task.task_no} as complete!`,
        metadata: { task_id: taskId, task_no: task.task_no },
        channel: "in_app",
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/my-work");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify task" };
  }
}

export async function deleteTask(taskId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized access" };
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/tasks");
    revalidatePath("/my-work");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete task" };
  }
}

export async function addTaskComment(taskId: string, commentText: string, parentId?: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized access" };
    }

    const supabase = createSupabaseAdminClient();

    const { data: newComment, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        user_id: currentUser.id,
        comment: commentText,
        parent_id: parentId || null,
      })
      .select("*")
      .single();

    if (error || !newComment) {
      return { success: false, error: error?.message || "Failed to post comment" };
    }

    await supabase.from("task_activity_logs").insert({
      task_id: taskId,
      actor_id: currentUser.id,
      action: "comment_added",
      details: { comment: commentText },
    });

    revalidatePath("/tasks");

    return { success: true, comment: newComment };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to add comment" };
  }
}
