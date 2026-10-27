/**
 * ReachInternational Mobile — OperatorPayrollCard Component
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes)
 * - 0 raw typography properties in StyleSheet.create (enforced via <Text variant="...">)
 * - Minimum 44px touch targets on all interactive buttons (hitSlopToMin48, minHeight: 38/44)
 * - Tactile financial indicators for Attended Days, Gross Pay, and Unpaid Balance
 * - 100% Web Parity with PayrollMobileCard (Disbursement Status Badge, SL No, Net Pay)
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { HighlightText } from '../ui/HighlightText';
import { Badge } from '../ui/Badge';
import { Pressable } from '../ui/touch/Pressable';
import { ChevronDown, ChevronUp, FileText, Edit2 } from '../ui/icon';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import type { HRPayrollOperator } from '@reachinternational/types';

export interface OperatorPayrollCardProps {
  operator: HRPayrollOperator;
  index: number;
  searchQuery?: string;
  isExpanded: boolean;
  onToggleExpand: (operatorId: string) => void;
  onViewUser: (name: string) => void;
  onViewSlip: (operator: HRPayrollOperator) => void;
  onEditStatement: (operator: HRPayrollOperator) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const OperatorPayrollCard: React.FC<OperatorPayrollCardProps> = ({
  operator,
  index,
  searchQuery = '',
  isExpanded,
  onToggleExpand,
  onViewUser,
  onViewSlip,
  onEditStatement,
  style,
  testID = 'operator-payroll-card',
}) => {
  const { theme } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        styles.operatorCard,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
    >
      {/* Card Header Row: Serial Badge, Name, Subtitle & Net Pay */}
      <View style={styles.cardHeader}>
        <Pressable
          variant="listRow"
          hitSlopToMin48
          style={styles.headerLeft}
          onPress={() => onViewUser(operator.full_name)}
          accessibilityRole="button"
          accessibilityLabel={`View profile for ${operator.full_name}`}
        >
          <View style={styles.nameRow}>
            <View
              style={[
                styles.slBadge,
                {
                  borderColor: theme.colors.hairline,
                  backgroundColor: theme.colors.canvas,
                },
              ]}
            >
              <Text variant="mono" weight="bold" style={{ color: theme.colors.mute }}>
                #{operator.sl_no || index + 1}
              </Text>
            </View>
            <HighlightText
              text={operator.full_name}
              query={searchQuery}
              variant="subheading"
              weight="bold"
              style={[styles.operatorName, { color: theme.colors.ink }]}
              numberOfLines={1}
            />
          </View>
          <HighlightText
            text={`${operator.phone || 'No phone'} • ${operator.city || operator.state || 'No location'}`}
            query={searchQuery}
            variant="caption"
            style={{ color: theme.colors.mute }}
          />
        </Pressable>

        <View style={styles.headerRight}>
          <Text variant="heading" weight="bold" style={{ color: '#059669' }}>
            ₹{(operator.net_pay || operator.total_pay || 0).toLocaleString('en-IN')}
          </Text>
          <Text
            variant="micro"
            weight="medium"
            style={{ color: theme.colors.mute, textTransform: 'uppercase' }}
          >
            Net Pay
          </Text>
        </View>
      </View>

      {/* Payout Status Row (Web Parity) */}
      <View style={[styles.statusRow, { borderTopColor: theme.colors.hairline }]}>
        <Text variant="caption" style={{ color: theme.colors.mute }}>
          Disbursement Status:
        </Text>
        {operator.status === 'paid' ? (
          <Badge variant="success" size="sm">
            Paid in Full
          </Badge>
        ) : (operator.balance_pay || 0) > 0 ? (
          <Badge variant="warning" size="sm">
            Partial (bal ₹{(operator.balance_pay || 0).toLocaleString('en-IN')})
          </Badge>
        ) : (
          <Badge variant="neutral" size="sm">
            Pending (₹{(operator.net_pay || operator.total_pay || 0).toLocaleString('en-IN')})
          </Badge>
        )}
      </View>

      {/* Quick Stat Tiles: Attended Days, Gross Pay, Unpaid Bal */}
      <View
        style={[
          styles.breakdownRow,
          {
            backgroundColor: theme.colors.canvas,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        <View style={styles.breakdownCol}>
          <Text
            variant="micro"
            weight="medium"
            style={{ color: theme.colors.mute, textTransform: 'uppercase', marginBottom: 2 }}
          >
            Attended Days
          </Text>
          <Text variant="caption" weight="semibold" style={{ color: '#2563eb' }}>
            {operator.attended_days || operator.work_days || 0} / {operator.working_days || 30}d
          </Text>
        </View>

        <View style={styles.breakdownCol}>
          <Text
            variant="micro"
            weight="medium"
            style={{ color: theme.colors.mute, textTransform: 'uppercase', marginBottom: 2 }}
          >
            Gross Pay
          </Text>
          <Text variant="caption" weight="semibold" style={{ color: theme.colors.ink }}>
            ₹{(operator.gross_pay || operator.total_pay || 0).toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.breakdownCol}>
          <Text
            variant="micro"
            weight="medium"
            style={{ color: theme.colors.mute, textTransform: 'uppercase', marginBottom: 2 }}
          >
            Unpaid Bal
          </Text>
          <Text
            variant="caption"
            weight="semibold"
            style={{
              color: (operator.balance_pay || 0) > 0 ? '#d97706' : theme.colors.mute,
            }}
          >
            ₹{(operator.balance_pay || 0).toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      {/* Expandable Accordion Breakdown */}
      {isExpanded && (
        <View style={[styles.detailsDrawer, { borderTopColor: theme.colors.hairline }]}>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Basic Monthly Salary:
            </Text>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              ₹{(operator.basic_salary || 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Attended Pay:
            </Text>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              ₹{(operator.attended_amount || 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Overtime (OT):
            </Text>
            <Text variant="caption" weight="medium" style={{ color: '#d97706' }}>
              {operator.ot_days || 0}d (₹{(operator.ot_amount || 0).toLocaleString('en-IN')})
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              PL Adjusted:
            </Text>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              {operator.pl_adjusted || 0}d (₹{(operator.pl_amount || 0).toLocaleString('en-IN')})
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Deductions (Loan/Adv):
            </Text>
            <Text variant="caption" weight="medium" style={{ color: '#dc2626' }}>
              -₹
              {(
                (operator.loan_deduction || 0) +
                (operator.advance_deduction || 0) +
                (operator.other_deductions || 0)
              ).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Agency Splits:
            </Text>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.ink }}>
              Reach ₹{operator.paid_reach || 0} • S&S ₹{operator.paid_ss || 0} • Quess ₹
              {operator.paid_quess || 0}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Leave Balance:
            </Text>
            <Text variant="caption" weight="medium" style={{ color: '#4f46e5' }}>
              {operator.pl_balance || 0} days remaining
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption" style={{ color: theme.colors.mute }}>
              Bank Account:
            </Text>
            <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
              {operator.bank_account_number || 'XXXXXXXX1234'} (
              {operator.bank_ifsc_code || 'BANK0001234'})
            </Text>
          </View>
        </View>
      )}

      {/* Card Actions Row */}
      <View style={styles.cardFooter}>
        <Pressable
          variant="buttonSecondary"
          hitSlopToMin48
          onPress={() => onToggleExpand(operator.operator_id)}
          style={[styles.actionBtn, { borderColor: theme.colors.hairline }]}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'Hide salary breakdown' : 'Show salary breakdown'}
        >
          {isExpanded ? (
            <>
              <ChevronUp size={13} color={theme.colors.mute} />
              <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                Less
              </Text>
            </>
          ) : (
            <>
              <ChevronDown size={13} color={theme.colors.mute} />
              <Text variant="caption" weight="medium" style={{ color: theme.colors.mute }}>
                Details
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          variant="buttonSecondary"
          hitSlopToMin48
          onPress={() => onViewSlip(operator)}
          style={[styles.actionBtn, { borderColor: theme.colors.hairline }]}
          accessibilityRole="button"
          accessibilityLabel="View salary slip"
        >
          <FileText size={13} color="#2563eb" />
          <Text variant="caption" weight="semibold" style={{ color: '#2563eb' }}>
            Slip
          </Text>
        </Pressable>

        <Pressable
          variant="buttonPrimary"
          hitSlopToMin48
          onPress={() => onEditStatement(operator)}
          style={[
            styles.actionBtn,
            { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Edit salary statement"
        >
          <Edit2 size={13} color={theme.colors.canvas} />
          <Text variant="caption" weight="semibold" style={{ color: theme.colors.canvas }}>
            Edit
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  operatorCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.sm,
    gap: spacingNumeric.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacingNumeric.sm,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  slBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radiusNumeric.xs,
    borderWidth: 1,
  },
  operatorName: {
    flexShrink: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacingNumeric.sm,
    paddingHorizontal: spacingNumeric.xs,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
  },
  breakdownCol: {
    alignItems: 'center',
    flex: 1,
  },
  detailsDrawer: {
    borderTopWidth: 1,
    paddingTop: spacingNumeric.sm,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    minHeight: 38,
  },
});

export default OperatorPayrollCard;
