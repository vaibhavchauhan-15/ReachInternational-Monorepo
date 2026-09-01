export function formatMachineDatabaseError(error: { code?: string; message?: string; details?: string }): { error: string; fieldErrors?: Record<string, string> } {
  const code = error.code;
  const message = error.message || "";

  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    return {
      error: "Permission denied: Your account role does not have authorization to add or modify machines. Please contact a system administrator.",
    };
  }

  if (code === "23505" || message.toLowerCase().includes("unique constraint") || message.toLowerCase().includes("duplicate key")) {
    if (message.includes("machines_machine_id_key") || message.includes("machine_id")) {
      return {
        error: "A machine with this Machine ID already exists in the inventory.",
        fieldErrors: { machine_id: "Machine ID already taken." },
      };
    }
    if (message.includes("serial_number") || message.includes("idx_machines_serial_number")) {
      return {
        error: "A machine with this Serial Number already exists in the inventory.",
        fieldErrors: { serial_number: "Serial Number already registered." },
      };
    }
    return {
      error: "A machine record with these unique details already exists.",
    };
  }

  if (code === "23514" || message.includes("check_machines_serial_number_not_empty")) {
    return {
      error: "Serial number is required and cannot be empty.",
      fieldErrors: { serial_number: "Serial number is mandatory." },
    };
  }

  if (code === "23502" || message.toLowerCase().includes("null value")) {
    return {
      error: "Required machine details are missing. Please complete all mandatory fields.",
    };
  }

  if (code === "23503" || message.toLowerCase().includes("foreign key")) {
    return {
      error: "Invalid reference: The selected supervisor or operator could not be found.",
    };
  }

  if (code === "22P02" || message.toLowerCase().includes("invalid input syntax")) {
    return {
      error: "Invalid format provided for machine details. Please check numeric inputs.",
    };
  }

  return {
    error: "Failed to save machine record. Please check your inputs and try again.",
  };
}
