"use client";

import React from "react";
import {
  AssignPersonnelModal,
  type AssignPersonnelModalProps,
} from "@/components/machines/AssignPersonnelModal";

export type AssignOperatorModalProps = AssignPersonnelModalProps;

/**
 * AssignOperatorModal — Unified Shift & Equipment Personnel Assignment Dialog
 * Replaces older single-operator assignment modal with canonical 24h multi-shift roster system.
 */
export function AssignOperatorModal(props: AssignOperatorModalProps) {
  return <AssignPersonnelModal {...props} />;
}
