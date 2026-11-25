import React from "react";
import { View, StyleSheet, ScrollView, Image, ActivityIndicator } from "react-native";
import type {
  ApprovalRequestListItem,
  AttachedDocumentSummary,
} from "@reachinternational/types";
import { Text } from "../ui/Text";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { formatTinyRelativeTime } from "@reachinternational/utils";
import {
  ChevronRight,
  Clock,
  UserCheck,
  Hash,
  Mail,
  Phone,
  Wrench,
  FileText,
  FileCheck2,
  RefreshCw,
  UserCog,
  ShieldAlert,
  AlertTriangle,
  Eye,
  Check,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react-native";
import { useTheme } from "../../lib/theming";
import { Pressable } from "../ui/touch/Pressable";
import { haptics } from "../../lib/haptics";

export interface MobileApprovalCardProps {
  item: ApprovalRequestListItem;
  onPress: (item: ApprovalRequestListItem) => void;
  onApprove?: (requestId: string) => Promise<void> | void;
  onRejectPrompt?: (item: ApprovalRequestListItem) => void;
  onOpenDocViewer?: (
    title: string,
    url: string,
    fileName?: string,
    docId?: string,
    isPending?: boolean
  ) => void;
  onVerifyDocument?: (docId: string, userId?: string) => Promise<void> | void;
  onRejectDocumentPrompt?: (doc: AttachedDocumentSummary, userId?: string) => void;
  canDecide?: boolean;
  isActionLoading?: boolean;
  isRejectLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Shared card context — every approval type renders through the same
// reusable primitives below (100% parity with the web ApprovalRow).
// ─────────────────────────────────────────────────────────────────────

interface CardCtx {
  item: ApprovalRequestListItem;
  fullName: string;
  payload: Record<string, any>;
  userId?: string;
  canDecide: boolean;
  isActionLoading: boolean;
  isRejectLoading: boolean;
  onOpenDocViewer?: MobileApprovalCardProps["onOpenDocViewer"];
  onVerifyDocument?: MobileApprovalCardProps["onVerifyDocument"];
  onRejectDocumentPrompt?: MobileApprovalCardProps["onRejectDocumentPrompt"];
  onDocPress: (doc: AttachedDocumentSummary) => void;
}

type ThemeColors = ReturnType<typeof useTheme>["colors"];

// ── Primitives ──────────────────────────────────────────────────────

/** Uniform content panel used by every approval type. */
function SectionPanel({
  colors,
  icon,
  title,
  titleColor,
  rightSlot,
  children,
}: {
  colors: ThemeColors;
  icon: React.ReactNode;
  title: string;
  titleColor?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.docsContainer,
        { backgroundColor: colors.canvas, borderColor: colors.hairline },
      ]}
    >
      <View style={styles.docsHeader}>
        <View style={styles.docsHeaderLeft}>
          {icon}
          <Text variant="label" style={{ color: titleColor || colors.ink }}>
            {title}
          </Text>
        </View>
        {rightSlot || null}
      </View>
      {children}
    </View>
  );
}

/** Compact empty-state row inside a SectionPanel. */
function PanelEmptyNote({
  colors,
  text,
}: {
  colors: ThemeColors;
  text: string;
}) {
  return (
    <View style={[styles.dashedEmptyCard, { borderColor: colors.hairline }]}>
      <FileText size={14} color={colors.mute} />
      <Text variant="caption" style={{ color: colors.mute, marginLeft: 6 }}>
        {text}
      </Text>
    </View>
  );
}

/** Single identity fact — muted icon, ink value. */
function Fact({
  colors,
  icon,
  value,
  fullWidth = false,
}: {
  colors: ThemeColors;
  icon: React.ReactNode;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <View style={fullWidth ? styles.contactItemFull : styles.contactItem}>
      {icon}
      <Text
        variant="caption"
        numberOfLines={1}
        style={styles.contactText}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Document chip (shared by every type that shows documents) ───────

interface DocChipProps {
  colors: ThemeColors;
  doc: AttachedDocumentSummary;
  displayLabel: string;
  /** Footer mode: inline actions, status pill, active pill, or nothing. */
  footer: "actions" | "status" | "active" | "none";
  canDecide: boolean;
  isActionLoading: boolean;
  isRejectLoading: boolean;
  onDocPress: (doc: AttachedDocumentSummary) => void;
  onVerifyDocument?: (docId: string, userId?: string) => Promise<void> | void;
  onRejectDocumentPrompt?: (doc: AttachedDocumentSummary, userId?: string) => void;
  userId?: string;
}

const DocChip = React.memo(function DocChip({
  colors,
  doc,
  displayLabel,
  footer,
  canDecide,
  isActionLoading,
  isRejectLoading,
  onDocPress,
  onVerifyDocument,
  onRejectDocumentPrompt,
  userId,
}: DocChipProps) {
  const docUrl = doc.thumb_signed_url || doc.signed_url;
  const isDocPending = doc.verification_status === "pending";
  const isDocVerified = doc.verification_status === "verified";
  const isDocRejected = doc.verification_status === "rejected";
  const showInlineActions =
    footer === "actions" &&
    canDecide &&
    isDocPending &&
    Boolean(onVerifyDocument) &&
    Boolean(onRejectDocumentPrompt);

  return (
    <View
      style={[
        styles.docCard,
        {
          backgroundColor: colors.canvasElevated,
          borderColor: colors.hairline,
        },
      ]}
    >
      <Pressable
        onPress={() => onDocPress(doc)}
        style={styles.docThumbContainer}
        accessibilityRole="button"
        accessibilityLabel={`View ${doc.label} document`}
      >
        {docUrl ? (
          <Image
            source={{ uri: docUrl }}
            style={styles.docThumbImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.docThumbFallback}>
            <FileText size={20} color={colors.mute} />
          </View>
        )}
        <View style={styles.docThumbOverlay}>
          <Eye size={12} color={colors.onPrimary} />
        </View>
      </Pressable>

      <Text variant="micro" numberOfLines={1} style={styles.docLabel}>
        {displayLabel}
      </Text>

      {footer === "none" ? null : footer === "active" ? (
        <View style={[styles.docStatusPill, { backgroundColor: colors.linkSoft }]}>
          <Text variant="micro" style={{ color: colors.primary }}>
            ACTIVE
          </Text>
        </View>
      ) : showInlineActions ? (
        <View style={[styles.docActionRow, { borderColor: colors.hairline }]}>
          <Pressable
            onPress={() => onRejectDocumentPrompt?.(doc, userId)}
            disabled={isActionLoading || isRejectLoading}
            style={[
              styles.docActionBtn,
              { borderColor: colors.errorSoft, backgroundColor: colors.errorSoft },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${doc.label}`}
          >
            <X size={15} color={colors.error} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            onPress={() => void onVerifyDocument?.(doc.id, userId)}
            disabled={isActionLoading || isRejectLoading}
            style={({ pressed }) => [
              styles.docActionBtn,
              {
                borderColor: colors.success,
                backgroundColor: pressed ? colors.successDeep : colors.success,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${doc.label}`}
          >
            <Check size={15} color={colors.onPrimary} strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : (
        <View
          style={[
            styles.docStatusPill,
            {
              backgroundColor: isDocVerified
                ? colors.successSoft
                : isDocRejected
                  ? colors.errorSoft
                  : colors.warningSoft,
            },
          ]}
        >
          <Text
            variant="micro"
            style={{
              color: isDocVerified
                ? colors.success
                : isDocRejected
                  ? colors.error
                  : colors.warningDeep,
            }}
          >
            {isDocVerified ? "APPROVED" : isDocRejected ? "REJECTED" : "PENDING"}
          </Text>
        </View>
      )}
    </View>
  );
});

/** Horizontal document strip used by every document-bearing approval type. */
function DocumentStrip({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.docsScroll}
    >
      {children}
    </ScrollView>
  );
}

// ── Type-driven content renderers (one per approval type) ───────────

function RegistrationBody({ ctx, colors }: { ctx: CardCtx; colors: ThemeColors }) {
  const docs = ctx.item.documents || [];
  return (
    <SectionPanel
      colors={colors}
      icon={<FileText size={13} color={colors.primary} />}
      title={`Attached Documents (${docs.length})`}
    >
      {docs.length > 0 ? (
        <DocumentStrip>
          {docs.map((doc) => (
            <DocChip
              key={doc.id}
              colors={colors}
              doc={doc}
              displayLabel={doc.label}
              footer="actions"
              canDecide={ctx.canDecide}
              isActionLoading={ctx.isActionLoading}
              isRejectLoading={ctx.isRejectLoading}
              onDocPress={ctx.onDocPress}
              onVerifyDocument={ctx.onVerifyDocument}
              onRejectDocumentPrompt={ctx.onRejectDocumentPrompt}
              userId={ctx.userId}
            />
          ))}
        </DocumentStrip>
      ) : (
        <PanelEmptyNote colors={colors} text="No KYC statutory documents attached yet" />
      )}
    </SectionPanel>
  );
}

function DocumentVerifyBody({ ctx, colors }: { ctx: CardCtx; colors: ThemeColors }) {
  const docs = ctx.item.documents || [];
  const payload = ctx.payload;
  const singleDocTarget =
    docs.find(
      (d) =>
        d.id === ctx.item.subject_id ||
        d.document_type_code === payload.document_type_code
    ) ||
    docs[0] ||
    null;

  if (docs.length > 1) {
    return (
      <SectionPanel
        colors={colors}
        icon={<FileCheck2 size={13} color={colors.primary} />}
        title={`Documents for Verification (${docs.length})`}
      >
        <DocumentStrip>
          {docs.map((doc) => (
            <DocChip
              key={doc.id}
              colors={colors}
              doc={doc}
              displayLabel={doc.label}
              footer="actions"
              canDecide={ctx.canDecide}
              isActionLoading={ctx.isActionLoading}
              isRejectLoading={ctx.isRejectLoading}
              onDocPress={ctx.onDocPress}
              onVerifyDocument={ctx.onVerifyDocument}
              onRejectDocumentPrompt={ctx.onRejectDocumentPrompt}
              userId={ctx.userId}
            />
          ))}
        </DocumentStrip>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel
      colors={colors}
      icon={<FileCheck2 size={13} color={colors.primary} />}
      title="Document for Verification"
    >
      {singleDocTarget ? (
        <DocumentStrip>
          <DocChip
            colors={colors}
            doc={singleDocTarget}
            displayLabel={singleDocTarget.label}
            footer="actions"
            canDecide={false}
            isActionLoading={ctx.isActionLoading}
            isRejectLoading={ctx.isRejectLoading}
            onDocPress={ctx.onDocPress}
            onVerifyDocument={ctx.onVerifyDocument}
            onRejectDocumentPrompt={ctx.onRejectDocumentPrompt}
            userId={ctx.userId}
          />
        </DocumentStrip>
      ) : (
        <PanelEmptyNote
          colors={colors}
          text="Statutory KYC document pending administrative review"
        />
      )}
    </SectionPanel>
  );
}

function DocumentReplaceBody({ ctx, colors }: { ctx: CardCtx; colors: ThemeColors }) {
  const { item, payload } = ctx;
  const docs = item.documents || [];

  const replacementDocs = docs.filter(
    (d) => d.id === item.id || d.label?.includes("(Replacement)")
  );
  if (replacementDocs.length === 0 && docs.length > 0) {
    replacementDocs.push(docs[0]);
  }
  const isMultiReplacement = replacementDocs.length > 1;

  const activeDocBeingReplaced = !isMultiReplacement
    ? docs.find(
      (d) =>
        !replacementDocs.includes(d) &&
        d.document_type_code === payload.document_type_code
    ) || null
    : null;

  const docTypeName = (payload.document_type_code || replacementDocs[0]?.label || "Document").replace(
    /_/g,
    " "
  );

  return (
    <SectionPanel
      colors={colors}
      icon={<RefreshCw size={13} color={colors.primary} />}
      title={
        isMultiReplacement
          ? `Replacement Documents (${replacementDocs.length})`
          : `Replacement: ${docTypeName}`
      }
    >
      <DocumentStrip>
        {replacementDocs.map((rDoc) => (
          <DocChip
            key={rDoc.id}
            colors={colors}
            doc={rDoc}
            displayLabel={
              rDoc.label?.includes("(Replacement)")
                ? rDoc.label
                : `${rDoc.label || docTypeName} (Replacement)`
            }
            footer="actions"
            canDecide={ctx.canDecide && isMultiReplacement}
            isActionLoading={ctx.isActionLoading}
            isRejectLoading={ctx.isRejectLoading}
            onDocPress={ctx.onDocPress}
            onVerifyDocument={ctx.onVerifyDocument}
            onRejectDocumentPrompt={ctx.onRejectDocumentPrompt}
            userId={ctx.userId}
          />
        ))}
        {activeDocBeingReplaced ? (
          <DocChip
            key={activeDocBeingReplaced.id}
            colors={colors}
            doc={activeDocBeingReplaced}
            displayLabel={`${activeDocBeingReplaced.label || docTypeName} (Active)`}
            footer="active"
            canDecide={false}
            isActionLoading={false}
            isRejectLoading={false}
            onDocPress={ctx.onDocPress}
            userId={ctx.userId}
          />
        ) : null}
      </DocumentStrip>
    </SectionPanel>
  );
}

function ProfileChangeBody({ ctx, colors }: { ctx: CardCtx; colors: ThemeColors }) {
  const { payload, item } = ctx;
  const changes: [string, any][] = payload.changes
    ? Object.entries(payload.changes)
    : [];
  const visibleChanges = changes.slice(0, 3);
  const hiddenCount = changes.length - visibleChanges.length;

  return (
    <SectionPanel
      colors={colors}
      icon={<UserCog size={13} color={colors.primary} />}
      title="Profile Modifications Requested"
      rightSlot={
        payload.reason ? (
          <Text variant="micro" numberOfLines={1} style={styles.reasonText}>
            &ldquo;{payload.reason}&rdquo;
          </Text>
        ) : null
      }
    >
      {visibleChanges.length > 0 ? (
        <View style={styles.diffStack}>
          {visibleChanges.map(([field, val]) => {
            const oldVal =
              val?.old_value !== undefined && val?.old_value !== null
                ? String(val.old_value)
                : "";
            const newVal =
              val?.new_value !== undefined && val?.new_value !== null
                ? String(val.new_value)
                : String(val ?? "");

            return (
              <View
                key={field}
                style={[
                  styles.diffRow,
                  {
                    backgroundColor: colors.canvasElevated,
                    borderColor: colors.hairline,
                  },
                ]}
              >
                <Text variant="caption" style={styles.diffField}>
                  {field.replace(/_/g, " ")}:
                </Text>
                <View style={styles.diffValuesRow}>
                  {oldVal ? (
                    <Text
                      variant="mono"
                      numberOfLines={1}
                      style={[styles.diffOld, { color: colors.error }]}
                    >
                      {oldVal}
                    </Text>
                  ) : null}
                  {oldVal ? (
                    <Text variant="caption" style={{ color: colors.mute, marginHorizontal: 4 }}>
                      &rarr;
                    </Text>
                  ) : null}
                  <Text
                    variant="mono"
                    numberOfLines={1}
                    style={[styles.diffNew, { color: colors.success }]}
                  >
                    {newVal || "(empty)"}
                  </Text>
                </View>
              </View>
            );
          })}
          {hiddenCount > 0 ? (
            <Text variant="micro" style={{ color: colors.mute, marginTop: 2 }}>
              +{hiddenCount} more change{hiddenCount > 1 ? "s" : ""} in request details
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="caption" style={{ color: colors.mute }}>
          {item.summary || "Sensitive profile changes pending review."}
        </Text>
      )}
    </SectionPanel>
  );
}

function AccountDeletionBody({ ctx, colors }: { ctx: CardCtx; colors: ThemeColors }) {
  const { payload, item } = ctx;
  return (
    <SectionPanel
      colors={colors}
      icon={<ShieldAlert size={14} color={colors.error} />}
      title="Account Deletion Request"
      titleColor={colors.error}
      rightSlot={
        <View style={[styles.docStatusPill, { backgroundColor: colors.errorSoft }]}>
          <Text variant="micro" style={{ color: colors.error }}>
            7-DAY GRACE
          </Text>
        </View>
      }
    >
      <View
        style={[
          styles.diffRow,
          {
            backgroundColor: colors.canvasElevated,
            borderColor: colors.hairline,
            marginTop: 4,
          },
        ]}
      >
        <Text variant="caption" style={{ color: colors.ink }}>
          Reason: &ldquo;{payload.reason || item.summary || "Permanent deletion requested by user"}&rdquo;
        </Text>
      </View>
    </SectionPanel>
  );
}

function ShiftConflictBody({ ctx, colors }: { ctx: CardCtx; colors: ThemeColors }) {
  const { payload, item } = ctx;
  return (
    <SectionPanel
      colors={colors}
      icon={<AlertTriangle size={14} color={colors.warning} />}
      title="Shift Conflict / Override"
      titleColor={colors.warningDeep}
    >
      <View style={styles.shiftConflictGrid}>
        <View
          style={[
            styles.shiftConflictBox,
            { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
          ]}
        >
          <Text variant="micro" style={{ color: colors.mute }}>
            MACHINE
          </Text>
          <Text variant="label" numberOfLines={1} style={{ color: colors.ink, marginTop: 2 }}>
            {payload.machine_code || payload.machine_id || "Fleet Machine"}
          </Text>
        </View>
        <View
          style={[
            styles.shiftConflictBox,
            { backgroundColor: colors.canvasElevated, borderColor: colors.hairline },
          ]}
        >
          <Text variant="micro" style={{ color: colors.mute }}>
            DATE &amp; SHIFT
          </Text>
          <Text variant="label" numberOfLines={1} style={{ color: colors.ink, marginTop: 2 }}>
            {payload.log_date || "—"} ({payload.shift_code || "—"})
          </Text>
        </View>
      </View>
      {item.summary ? (
        <Text variant="caption" numberOfLines={1} style={{ color: colors.mute, marginTop: 6 }}>
          {item.summary}
        </Text>
      ) : null}
    </SectionPanel>
  );
}

function FallbackBody({ ctx, colors }: { ctx: CardCtx; colors: ThemeColors }) {
  const docs = ctx.item.documents || [];
  if (docs.length > 0) {
    return (
      <SectionPanel
        colors={colors}
        icon={<FileText size={13} color={colors.primary} />}
        title={`Attached Documents (${docs.length})`}
      >
        <DocumentStrip>
          {docs.map((doc) => (
            <DocChip
              key={doc.id}
              colors={colors}
              doc={doc}
              displayLabel={doc.label}
              footer="none"
              canDecide={false}
              isActionLoading={false}
              isRejectLoading={false}
              onDocPress={ctx.onDocPress}
              userId={ctx.userId}
            />
          ))}
        </DocumentStrip>
      </SectionPanel>
    );
  }
  if (ctx.item.summary) {
    return (
      <View
        style={[
          styles.fallbackSummaryBox,
          { backgroundColor: colors.canvas, borderColor: colors.hairline },
        ]}
      >
        <Text variant="caption" numberOfLines={2}>
          {ctx.item.summary}
        </Text>
      </View>
    );
  }
  return null;
}

// ── Registry: type_key → content body ───────────────────────────────

const TYPE_BODY: Record<
  string,
  React.ComponentType<{ ctx: CardCtx; colors: ThemeColors }>
> = {
  registration: RegistrationBody,
  document_verify: DocumentVerifyBody,
  document_replace: DocumentReplaceBody,
  profile_change: ProfileChangeBody,
  account_deletion: AccountDeletionBody,
  shift_conflict: ShiftConflictBody,
};

// ── Registry: type_key → which user-data facts are relevant ─────────

type FactKey = "email" | "phone" | "fleet" | "supervisor";

const TYPE_FACTS: Record<string, FactKey[]> = {
  registration: ["email", "phone", "fleet", "supervisor"],
  document_verify: ["email", "phone"],
  document_replace: ["email", "phone"],
  profile_change: ["email"],
  account_deletion: ["email"],
  shift_conflict: ["fleet", "supervisor"],
};

const FALLBACK_FACTS: FactKey[] = ["email", "phone", "fleet", "supervisor"];

// ─────────────────────────────────────────────────────────────────────
// The single reusable approval card — every approval type renders
// through this shell (header → identity → type body → action footer).
// ─────────────────────────────────────────────────────────────────────

export const MobileApprovalCard = React.memo(function MobileApprovalCard({
  item,
  onPress,
  onApprove,
  onRejectPrompt,
  onOpenDocViewer,
  onVerifyDocument,
  onRejectDocumentPrompt,
  canDecide = false,
  isActionLoading = false,
  isRejectLoading = false,
}: MobileApprovalCardProps) {
  const { colors } = useTheme();

  const isPending = item.status === "pending";
  const showDecideActions = isPending && canDecide && Boolean(onApprove) && Boolean(onRejectPrompt);

  // Identity resolution
  const payload = (item.payload || {}) as Record<string, any>;
  const fullName = item.requester_name || item.subject_label || "Applicant";
  const role = item.role;
  const empId = item.employee_id;

  const isOperator =
    role?.toLowerCase() === "operator" ||
    payload.role?.toLowerCase() === "operator";
  const supervisorName =
    item.supervisor_name ||
    payload.supervisor_name ||
    payload.supervisorName ||
    null;

  // Type-driven content + user-data facts ("show the data the approval needs")
  const TypeBody = TYPE_BODY[item.type_key] || FallbackBody;
  const factKeys = TYPE_FACTS[item.type_key] || FALLBACK_FACTS;

  const handleCardPress = () => {
    haptics.select();
    onPress(item);
  };

  const handleApprovePress = () => {
    if (onApprove) {
      haptics.confirm();
      void onApprove(item.id);
    }
  };

  const handleRejectPress = () => {
    if (onRejectPrompt) {
      haptics.reject();
      onRejectPrompt(item);
    }
  };

  const handleDocPress = React.useCallback(
    (doc: AttachedDocumentSummary) => {
      haptics.select();
      const docUrl = doc.signed_url || doc.thumb_signed_url;
      if (docUrl && onOpenDocViewer) {
        onOpenDocViewer(
          doc.label || "DOCUMENT",
          docUrl,
          `${doc.document_type_code}.jpg`,
          doc.id,
          doc.verification_status === "pending"
        );
      } else {
        onPress(item);
      }
    },
    [onOpenDocViewer, onPress, item]
  );

  const ctx: CardCtx = {
    item,
    fullName,
    payload,
    userId: payload.user_id || item.requested_by || item.subject_id || undefined,
    canDecide,
    isActionLoading,
    isRejectLoading,
    onOpenDocViewer,
    onVerifyDocument,
    onRejectDocumentPrompt,
    onDocPress: handleDocPress,
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.canvasElevated,
          borderColor: colors.hairline,
        },
      ]}
    >
      {/* ── Header: type / status / role / priority chips ── */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <Badge variant="outline">
            <Text variant="micro">{item.type_label}</Text>
          </Badge>
          <Badge
            variant={
              item.status === "approved"
                ? "default"
                : item.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
          >
            <Text variant="micro">{item.status.toUpperCase()}</Text>
          </Badge>
          {role ? (
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: colors.linkSoft,
                  borderColor: colors.linkSoft,
                },
              ]}
            >
              <Text variant="micro" style={{ color: colors.primary }}>
                {role.toUpperCase()}
              </Text>
            </View>
          ) : null}
          {item.priority >= 8 ? (
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor: colors.errorSoft,
                  borderColor: colors.errorSoft,
                },
              ]}
            >
              <Text variant="micro" style={{ color: colors.error }}>
                HIGH
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Identity: name + employee chip + per-type user-data facts ── */}
      <Pressable
        onPress={handleCardPress}
        style={({ pressed }) => [
          styles.identityContainer,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`View ${fullName} approval details`}
      >
        <View style={styles.nameRow}>
          <Text variant="heading" numberOfLines={1} style={styles.fullName}>
            {fullName}
          </Text>
          {empId ? (
            <View
              style={[
                styles.empBadge,
                {
                  backgroundColor: colors.canvas,
                  borderColor: colors.hairline,
                },
              ]}
            >
              <Hash size={11} color={colors.violet} />
              <Text variant="mono">{empId}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.contactGrid}>
          {factKeys.includes("email") && item.email ? (
            <Fact
              colors={colors}
              icon={<Mail size={12} color={colors.mute} />}
              value={item.email}
            />
          ) : null}
          {factKeys.includes("phone") && item.phone ? (
            <Fact
              colors={colors}
              icon={<Phone size={12} color={colors.mute} />}
              value={item.phone}
            />
          ) : null}
          {factKeys.includes("fleet") && item.machine_category ? (
            <Fact
              colors={colors}
              icon={<Wrench size={12} color={colors.mute} />}
              value={`Fleet: ${item.machine_category}`}
              fullWidth
            />
          ) : null}
          {factKeys.includes("supervisor") && isOperator ? (
            <Fact
              colors={colors}
              icon={<UserCheck size={12} color={colors.mute} />}
              value={`Supervisor: ${supervisorName || "Unassigned"}`}
              fullWidth
            />
          ) : null}
        </View>
      </Pressable>

      {/* ── Type-specific content (same panel + primitives for every type) ── */}
      <TypeBody ctx={ctx} colors={colors} />

      {/* ── Footer: submitted time + decision controls ── */}
      <View style={[styles.actionBar, { borderTopColor: colors.hairline }]}>
        <View style={styles.timeRow}>
          <Clock size={12} color={colors.mute} />
          <Text variant="micro" style={{ color: colors.mute }}>
            {formatTinyRelativeTime(item.created_at)}
          </Text>
        </View>

        {showDecideActions ? (
          <View style={styles.decideGroup}>
            {/* Quick Reject Button (Single Spinner) */}
            <Button
              variant="outline"
              size="sm"
              onPress={handleRejectPress}
              disabled={isActionLoading || isRejectLoading}
              style={[
                styles.rejectBtn,
                {
                  borderColor: colors.errorSoft,
                  backgroundColor: colors.errorSoft,
                },
              ]}
            >
              {isRejectLoading ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <XCircle size={14} color={colors.error} />
                  <Text variant="label" style={{ color: colors.error, marginLeft: 4 }}>
                    Reject
                  </Text>
                </>
              )}
            </Button>

            {/* Quick Approve Button (Single Spinner) */}
            <Button
              variant="default"
              size="sm"
              onPress={handleApprovePress}
              disabled={isActionLoading || isRejectLoading}
              style={[styles.approveBtn, { backgroundColor: colors.success }]}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <CheckCircle2 size={14} color={colors.onPrimary} />
                  <Text variant="label" style={{ color: colors.onPrimary, marginLeft: 4 }}>
                    Approve
                  </Text>
                </>
              )}
            </Button>
          </View>
        ) : !isPending ? (
          <View style={styles.decidedNotice}>
            {item.status === "approved" ? (
              <View style={styles.decidedRow}>
                <CheckCircle2 size={14} color={colors.success} />
                <Text variant="label" style={{ color: colors.success, marginLeft: 4 }}>
                  Approved
                </Text>
              </View>
            ) : item.status === "rejected" ? (
              <View style={styles.decidedRow}>
                <XCircle size={14} color={colors.error} />
                <Text variant="label" style={{ color: colors.error, marginLeft: 4 }}>
                  Rejected
                </Text>
              </View>
            ) : (
              <Text variant="label" style={{ color: colors.mute }}>
                {item.status.toUpperCase()}
              </Text>
            )}
          </View>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onPress={handleCardPress}
            style={styles.detailsBtn}
          >
            <Text variant="label">View Details</Text>
            <ChevronRight size={14} color={colors.ink} style={{ marginLeft: 4 }} />
          </Button>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  identityContainer: {
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  fullName: {
    flex: 1,
  },
  empBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 6,
    maxWidth: "48%",
  },
  contactItemFull: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
  },
  contactText: {
    flex: 1,
  },
  reasonText: {
    fontStyle: "italic",
    maxWidth: 160,
  },
  diffStack: {
    gap: 4,
    marginTop: 4,
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  diffField: {
    textTransform: "capitalize",
  },
  diffValuesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  diffOld: {
    textDecorationLine: "line-through",
    maxWidth: 90,
  },
  diffNew: {
    maxWidth: 100,
  },
  shiftConflictGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  shiftConflictBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  docsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  docsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  docsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  docCard: {
    width: 112,
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
  },
  docThumbContainer: {
    width: 98,
    height: 64,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    position: "relative",
    marginBottom: 4,
  },
  docThumbImage: {
    width: "100%",
    height: "100%",
  },
  docThumbFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  docThumbOverlay: {
    position: "absolute",
    bottom: 3,
    right: 3,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 10,
    padding: 3,
  },
  docLabel: {
    width: "100%",
    textAlign: "center",
    marginBottom: 2,
  },
  docStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  docActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 1,
  },
  docActionBtn: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dashedEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 10,
    marginBottom: 12,
  },
  fallbackSummaryBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    marginBottom: 12,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  decideGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rejectBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
  },
  approveBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
  },
  decidedNotice: {
    marginLeft: "auto",
  },
  decidedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
