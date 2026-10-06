const fs = require('fs');

const filePath = 'apps/mobile/app/(app)/payroll.tsx';
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Remove Modal from react-native
content = content.replace(
  `  Modal,
  Alert,`,
  `  Alert,`
);

// 2. Add AppModal to imports
content = content.replace(
  `import { MobileHeader, Card, Badge, EmptyState, KPICard, KPIGrid, HighlightText, type HeaderActionItem, Text, useTypeStyle } from '../../components/ui';`,
  `import { MobileHeader, Card, Badge, EmptyState, KPICard, KPIGrid, HighlightText, type HeaderActionItem, Text, useTypeStyle, AppModal } from '../../components/ui';`
);

// 3. Modal 1 opening
content = content.replace(
  `      {/* Salary Slip Modal */}
      <Modal
        visible={!!viewSlipOp}
        transparent
        animationType="fade"
        onRequestClose={() => setViewSlipOp(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                maxHeight: '85%',
              },
            ]}
          >`,
  `      {/* Salary Slip Modal */}
      <AppModal
        visible={!!viewSlipOp}
        onClose={() => setViewSlipOp(null)}
        variant="bottom"
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
              maxHeight: '85%',
            },
          ]}
        >`
);

// 4. Modal 1 closing
content = content.replace(
  `            <TouchableOpacity
              onPress={() => setViewSlipOp(null)}
              style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink, marginTop: 8 }]}
            >
              <Text style={{ color: theme.colors.canvas, textAlign: 'center' }}>
                Close Slip
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>`,
  `            <TouchableOpacity
              onPress={() => setViewSlipOp(null)}
              style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink, marginTop: 8 }]}
            >
              <Text style={{ color: theme.colors.canvas, textAlign: 'center' }}>
                Close Slip
              </Text>
            </TouchableOpacity>
          </View>
      </AppModal>`
);

// 5. Modal 2 opening
content = content.replace(
  `      {/* Edit Statement Modal */}
      <Modal
        visible={!!editingOperator}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingOperator(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
                maxHeight: '90%',
              },
            ]}
          >`,
  `      {/* Edit Statement Modal */}
      <AppModal
        visible={!!editingOperator}
        onClose={() => setEditingOperator(null)}
        variant="bottom"
      >
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
              maxHeight: '90%',
            },
          ]}
        >`
);

// 6. Modal 2 closing
content = content.replace(
  `              <TouchableOpacity
                onPress={handleSaveStatement}
                disabled={savingStatement}
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink }]}
              >
                <Text style={{ color: theme.colors.canvas }}>
                  {savingStatement ? 'Saving...' : 'Save Statement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>`,
  `              <TouchableOpacity
                onPress={handleSaveStatement}
                disabled={savingStatement}
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.ink }]}
              >
                <Text style={{ color: theme.colors.canvas }}>
                  {savingStatement ? 'Saving...' : 'Save Statement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
      </AppModal>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated apps/mobile/app/(app)/payroll.tsx');
