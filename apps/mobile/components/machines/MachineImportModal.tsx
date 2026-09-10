import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Share,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { FileSpreadsheet, X, Download, CheckCircle2, AlertCircle } from 'lucide-react-native';

export interface MachineImportModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MachineImportModal: React.FC<MachineImportModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useTheme();

  const handleShareTemplateUrl = async () => {
    try {
      await Share.share({
        title: 'Reach International Machines Excel Import Template',
        message:
          'Reach International Bulk Machines Import Guidelines:\n\n' +
          'Columns required in Excel/CSV:\n' +
          '1. Model (Mandatory, e.g. 50B-9)\n' +
          '2. Serial Number (Mandatory, unique)\n' +
          '3. Year of Mfg (Mandatory, e.g. 2024)\n' +
          '4. Manufacturer (Mandatory, e.g. Hyundai)\n' +
          '5. Hour Meter (HMR) (Optional, e.g. 1500)\n' +
          '6. Health Status (active | under_maintenance | breakdown)\n' +
          '7. Rental Status (available | rented)\n\n' +
          'Use the Reach International Web Portal (https://dashboard-reachinternational.vercel.app/machines) for direct file upload and validation.',
      });
    } catch {
      // dismissed
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
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
                    <Text style={[styles.title, { color: theme.colors.ink }]}>
                      Bulk Excel Import
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
                      Import fleet machinery via spreadsheets
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={theme.colors.mute} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Notice Banner */}
                <View style={[styles.banner, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  <AlertCircle size={16} color={theme.colors.link} style={{ marginTop: 2 }} />
                  <Text style={[styles.bannerText, { color: theme.colors.body }]}>
                    To import batches of 10+ machines simultaneously, use standard .xlsx or .csv files following the Reach International catalog schema.
                  </Text>
                </View>

                {/* Mandatory Fields Guide */}
                <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>
                  Required Spreadsheet Columns
                </Text>

                <View style={[styles.guideCard, { backgroundColor: theme.colors.canvas, borderColor: theme.colors.hairline }]}>
                  {[
                    { name: 'Model', desc: 'Equipment model name (e.g. 50B-9, 8FG30)', req: true },
                    { name: 'Serial Number', desc: 'Unique serial identifier from chassis', req: true },
                    { name: 'Year of Mfg (YUM)', desc: 'Manufacturing year (e.g. 2024)', req: true },
                    { name: 'Manufacturer', desc: 'OEM brand (e.g. Hyundai, Toyota)', req: true },
                    { name: 'Hour Meter (HMR)', desc: 'Initial meter reading in hours', req: false },
                    { name: 'Health Status', desc: 'active, under_maintenance, or breakdown', req: false },
                    { name: 'Rental Status', desc: 'available or rented', req: false },
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
                        <Text style={[styles.colName, { color: theme.colors.ink }]}>
                          {col.name}
                        </Text>
                        {col.req && (
                          <View style={styles.reqBadge}>
                            <Text style={styles.reqText}>REQUIRED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.colDesc, { color: theme.colors.mute }]}>
                        {col.desc}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={[styles.footer, { borderTopColor: theme.colors.hairline }]}>
                <TouchableOpacity
                  onPress={handleShareTemplateUrl}
                  style={[styles.shareBtn, { backgroundColor: theme.colors.primary }]}
                  activeOpacity={0.8}
                >
                  <Download size={14} color={theme.colors.onPrimary} />
                  <Text style={[styles.shareBtnText, { color: theme.colors.onPrimary }]}>
                    Share Schema & Instructions
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
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
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
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
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  colName: {
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 9,
    fontWeight: '800',
    color: '#ef4444',
  },
  colDesc: {
    fontSize: 11,
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
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
