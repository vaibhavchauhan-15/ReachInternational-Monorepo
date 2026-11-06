import test from "node:test";
import assert from "node:assert/strict";
import {
  CreateHourLogSchema,
  SubmitHourLogSchema,
  UpdateHourLogSchema,
  DeleteHourLogSchema,
} from "./hourMeter.ts";

test("CreateHourLogSchema accepts valid shift log", () => {
  const validData = {
    machine_id: "8d0011dd-150e-4f71-b166-a8eb9e460480",
    operator_id: "b3400740-3e79-44c7-9aec-a0ec3ccd22ce",
    client_id: "ea0dbad0-6ce8-4965-9fdd-2d6287b3063c",
    log_date: "2026-11-04",
    start_meter: 100.5,
    end_meter: 108.5,
    shift_code: "S1",
    shift: "Shift S1",
    start_time: "06:00 AM",
    end_time: "02:00 PM",
    normal_working_hours: 8,
    overtime_hours: 0,
    is_breakdown: false,
    machine_condition: "good" as const,
    location: "Main Site",
    remarks: "Smooth shift operation",
  };

  const parsed = CreateHourLogSchema.safeParse(validData);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.start_meter, 100.5);
    assert.equal(parsed.data.end_meter, 108.5);
  }
});

test("CreateHourLogSchema accepts idle standby shift (0.0 running hours)", () => {
  const idleData = {
    machine_id: "8d0011dd-150e-4f71-b166-a8eb9e460480",
    log_date: "2026-11-04",
    start_meter: 250.0,
    end_meter: 250.0,
  };
  const parsed = CreateHourLogSchema.safeParse(idleData);
  assert.equal(parsed.success, true);
});

test("CreateHourLogSchema accepts exact 24.0 hours running in single shift", () => {
  const maxHoursData = {
    machine_id: "8d0011dd-150e-4f71-b166-a8eb9e460480",
    log_date: "2026-11-04",
    start_meter: 100.0,
    end_meter: 124.0,
  };
  const parsed = CreateHourLogSchema.safeParse(maxHoursData);
  assert.equal(parsed.success, true);
});

test("CreateHourLogSchema rejects missing machine_id", () => {
  const invalid = {
    machine_id: "",
    log_date: "2026-11-04",
    start_meter: 100,
    end_meter: 105,
  };
  const parsed = CreateHourLogSchema.safeParse(invalid);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues[0]?.message, "Machine reference is required");
  }
});

test("CreateHourLogSchema rejects negative meter readings", () => {
  const invalidNegative = {
    machine_id: "valid-machine-uuid",
    log_date: "2026-11-04",
    start_meter: -5,
    end_meter: 10,
  };
  const parsed = CreateHourLogSchema.safeParse(invalidNegative);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.match(parsed.error.issues[0]?.message || "", /non-negative/i);
  }
});

test("CreateHourLogSchema rejects meter regression (end_meter < start_meter)", () => {
  const invalidRegression = {
    machine_id: "valid-machine-uuid",
    log_date: "2026-11-04",
    start_meter: 120.0,
    end_meter: 110.0,
  };
  const parsed = CreateHourLogSchema.safeParse(invalidRegression);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues[0]?.message, "End meter reading cannot be less than start meter reading");
  }
});

test("CreateHourLogSchema rejects running hours exceeding 24h", () => {
  const invalidExcess = {
    machine_id: "valid-machine-uuid",
    log_date: "2026-11-04",
    start_meter: 100.0,
    end_meter: 124.5,
  };
  const parsed = CreateHourLogSchema.safeParse(invalidExcess);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues[0]?.message, "Machine running hours cannot exceed 24 hours in a single log.");
  }
});

test("CreateHourLogSchema rejects premature logging with future end_datetime", () => {
  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const premature = {
    machine_id: "valid-machine-uuid",
    log_date: "2026-11-04",
    start_meter: 100,
    end_meter: 108,
    end_datetime: futureDate,
  };
  const parsed = CreateHourLogSchema.safeParse(premature);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues[0]?.message, "Cannot log before shift end.");
  }
});

test("CreateHourLogSchema rejects breakdown duration exceeding shift duration", () => {
  const breakdownExcess = {
    machine_id: "valid-machine-uuid",
    log_date: "2026-11-04",
    start_meter: 100,
    end_meter: 108,
    start_datetime: "2026-11-04T06:00:00+05:30",
    end_datetime: "2026-11-04T14:00:00+05:30", // 8.0h shift
    is_breakdown: true,
    breakdown_hours: 9.5, // 9.5h > 8.0h
  };
  const parsed = CreateHourLogSchema.safeParse(breakdownExcess);
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues[0]?.message, "Breakdown duration cannot exceed total shift duration.");
  }
});

test("SubmitHourLogSchema accepts valid camelCase web payload", () => {
  const validWeb = {
    machineId: "8d0011dd-150e-4f71-b166-a8eb9e460480",
    operatorId: "b3400740-3e79-44c7-9aec-a0ec3ccd22ce",
    clientId: "ea0dbad0-6ce8-4965-9fdd-2d6287b3063c",
    startDate: "2026-11-04",
    startMeter: 150.0,
    endMeter: 158.0,
    startTime: "06:00 AM",
    endTime: "02:00 PM",
    shiftCode: "S1",
    machineCondition: "good" as const,
  };
  const parsed = SubmitHourLogSchema.safeParse(validWeb);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.machineId, validWeb.machineId);
    assert.equal(parsed.data.endMeter - parsed.data.startMeter, 8.0);
  }
});

test("SubmitHourLogSchema rejects meter regression and >24 hours", () => {
  const regressed = {
    machineId: "8d0011dd-150e-4f71-b166-a8eb9e460480",
    startMeter: 200.0,
    endMeter: 195.0,
  };
  const parsedRegressed = SubmitHourLogSchema.safeParse(regressed);
  assert.equal(parsedRegressed.success, false);
  if (!parsedRegressed.success) {
    assert.equal(parsedRegressed.error.issues[0]?.message, "Ending hour meter reading cannot be less than starting hour meter reading.");
  }

  const excess = {
    machineId: "8d0011dd-150e-4f71-b166-a8eb9e460480",
    startMeter: 200.0,
    endMeter: 225.0,
  };
  const parsedExcess = SubmitHourLogSchema.safeParse(excess);
  assert.equal(parsedExcess.success, false);
  if (!parsedExcess.success) {
    assert.equal(parsedExcess.error.issues[0]?.message, "Machine running hours cannot exceed 24 hours in a single log.");
  }
});

test("UpdateHourLogSchema and DeleteHourLogSchema enforce UUID logId", () => {
  const validLogId = "b3400740-3e79-44c7-9aec-a0ec3ccd22ce";
  assert.equal(UpdateHourLogSchema.safeParse({ logId: validLogId }).success, true);
  assert.equal(DeleteHourLogSchema.safeParse({ logId: validLogId }).success, true);

  assert.equal(UpdateHourLogSchema.safeParse({ logId: "not-a-uuid" }).success, false);
  assert.equal(DeleteHourLogSchema.safeParse({ logId: "not-a-uuid" }).success, false);
});
