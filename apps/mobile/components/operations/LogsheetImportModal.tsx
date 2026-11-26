import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text } from '../ui/Text';
import { AppModal } from '../ui/AppModal';
import { Touchable } from '../ui/Touchable';
import { haptics } from '../../lib/haptics';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { FileSpreadsheet, X, Download, CheckCircle2, AlertCircle } from '../ui/icon';
import { getAppUrl } from '../../lib/env';

export interface LogsheetImportModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Admin-only Bulk Machine Logsheet Import guide (native parity entry point).
 *
 * Direct .xlsx upload and validation run on the Reach International Web Portal
 * (documented platform limitation: Excel workbook generation/parsing is a
 * web-portal workflow). Native keeps full parity of the entry point, the field
 * contract and the shareable instructions — matching the established
 * `MachineImportModal` precedent for bulk Excel imports.
 */
export const LogsheetImportModal: React.FC<LogsheetImportModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();

  const handleShareGuide = async () => {
    haptics.select();
    try {
      await Share.share({
        title: 'Reach International Machine Logsheet Import Guide',
        message:
          'Reach International Bulk Machine Logsheet Import (Admin):\n\n' +
          '1. Open the Reach International Web Portal → Operations → Import Logsheet (Excel).\n' +
          '2. Select the machine and download the standardized Excel template.\n' +
          '3. Fill historical records (delete the example rows) and upload the workbook.\n' +
          '4. Review the validated preview, confirm, and the records are imported atomically.\n\n' +
          'Mandatory fields: Log Date, Operator Employee ID, Start Time, End Time, Start HMR, End HMR.\n' +
          'Optional: Shift Code, Overtime Hours, Machine Condition, Breakdown times, Remarks.\n\n' +
          `Web Portal: ${getAppUrl()}/operations`,
      });
    } catch {
      // dismissed
    }
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant="bottom"
      testID="logsheet-import-modal"
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.iconWrap, { backgroundColor: '#10b98118' }]}>
              <FileSpreadsheet size={20} color="#10b981" />
            </View>
            <View>
              <Text variant="heading" style={{ color: theme.colors.ink }}>
                Import Logsheet (Excel)
              </Text>
              <Text variant="caption" style={[styles.subtitle, { color: theme.colors.mute }]}>
                Bulk back-fill of historical machine logs
              </Text>
            </View>
          </View>

          <Touchable
            preset="icon"
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
          >
            <X size={16} color={theme.colors.mute} />
          </Touchable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Notice Banner */}
          <View style={[styles.banner, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            <AlertCircle size={16} color={theme.colors.link} style={{ marginTop: 2 }} />
            <Text variant="caption" style={[styles.bannerText, { color: theme.colors.body }]}>
              Excel upload, row-by-row validation and the atomic import run on the Reach International Web Portal
              (Operations → Import Logsheet). This guide lists the exact template fields so the workbook can be
              prepared from a phone.
            </Text>
          </View>

          {/* Mandatory Fields Guide */}
          <Text variant="caption" style={[styles.sectionTitle, { color: theme.colors.ink }]}>
            Template Fields (v1.0)
          </Text>

          <View style={[styles.guideCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
            {[
              { name: 'Log Date', desc: 'Historical work date (YYYY-MM-DD); future dates rejected', req: true },
              { name: 'Operator Employee ID', desc: 'Exact employee record (e.g. EMP-0338); name accepted as fallback', req: true },
              { name: 'Start / End Time', desc: 'HH:MM (24h) or HH:MM AM/PM; overnight shifts supported', req: true },
              { name: 'Start / End HMR', desc: 'Hour meter readings (max 2 decimals); running hours = end − start', req: true },
              { name: 'Shift Code', desc: 'Optional; auto-derived from Start Time when blank', req: false },
              { name: 'Overtime Hours', desc: 'Optional; auto-calculated beyond 8h per shift when blank', req: false },
              { name: 'Machine Condition', desc: 'good | fair | needs_attention | breakdown', req: false },
              { name: 'Breakdown? / Times', desc: 'Yes/No plus breakdown start and end when Yes', req: false },
              { name: 'Remarks', desc: 'Optional free text up to 500 characters', req: false },
            ].map((col, idx) => (
              <View
                key={col.name}
                style={[
                  styles.guideRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline },
                ]}
              >
                <View style={styles.guideLeft}>
                  <CheckCircle2 size={14} color={col.req ? theme.colors.success : theme.colors.mute} />
                  <Text variant="label" style={{ color: theme.colors.ink }}>
                    {col.name}
                  </Text>
                  {col.req && (
                    <View style={styles.reqBadge}>
                      <Text variant="caption" style={styles.reqText}>REQUIRED</Text>
                    </View>
                  )}
                </View>
                <Text variant="caption" style={[styles.colDesc, { color: theme.colors.mute }]}>
                  {col.desc}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
          <Touchable
            preset="button"
            onPress={handleShareGuide}
            style={[styles.shareBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Download size={14} color={theme.colors.onPrimary} />
            <Text variant="label" style={{ color: theme.colors.onPrimary }}>
              Share Import Guide
            </Text>
          </Touchable>
        </View>
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radiusNumeric.lg,
    borderTopRightRadius: radiusNumeric.lg,
    borderWidth: 1,
    maxHeight: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingNumeric.lg,
    paddingTop: spacingNumeric.md,
    paddingBottom: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 460,
  },
  bodyContent: {
    padding: spacingNumeric.lg,
    gap: spacingNumeric.md,
  },
  banner: {
    flexDirection: 'row',
    gap: spacingNumeric.sm,
    padding: spacingNumeric.md,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  guideCard: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  guideRow: {
    padding: spacingNumeric.sm,
    gap: 4,
  },
  guideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  reqBadge: {
    backgroundColor: '#ef444415',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  reqText: {
    color: '#ef4444',
  },
  colDesc: {
    marginLeft: 20,
  },
  footer: {
    paddingHorizontal: spacingNumeric.lg,
    paddingVertical: spacingNumeric.sm,
    borderTopWidth: 1,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.xs,
    paddingVertical: 12,
    borderRadius: radiusNumeric.lg,
    minHeight: 44,
  },
});
