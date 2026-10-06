const fs = require('fs');

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  for (const [target, replacement] of replacements) {
    if (!content.includes(target)) {
      console.error(`Target not found in ${filePath}:\n${target.slice(0, 100)}...`);
      throw new Error(`Target not found in ${filePath}`);
    }
    content = content.replace(target, replacement);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filePath}`);
}

// 10. apps/mobile/app/(app)/attendance.tsx
replaceInFile('apps/mobile/app/(app)/attendance.tsx', [
  [
    `  Modal,
  Alert,`,
    `  Alert,`
  ],
  [
    `import { MobileHeader, Card, Badge, EmptyState, HighlightText, KPICard, KPIGrid, type HeaderActionItem , Text } from '../../components/ui';`,
    `import { MobileHeader, Card, Badge, EmptyState, HighlightText, KPICard, KPIGrid, type HeaderActionItem , Text, AppModal } from '../../components/ui';`
  ],
  [
    `      {/* Employee Detail / Calendar Modal (Managers & Admins only) */}
      {!isOperator && (
        <Modal
          visible={!!selectedEmployee}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setSelectedEmployee(null)}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>`,
    `      {/* Employee Detail / Calendar Modal (Managers & Admins only) */}
      {!isOperator && (
        <AppModal
          visible={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          variant="fullscreen"
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>`
  ],
  [
    `              </ScrollView>
            ) : null}
          </View>
        </Modal>
      )}`,
    `              </ScrollView>
            ) : null}
          </View>
        </AppModal>
      )}`
  ]
]);

// 11. apps/mobile/app/(app)/clients.tsx
replaceInFile('apps/mobile/app/(app)/clients.tsx', [
  [
    `import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, Switch, ActivityIndicator, Linking, Animated, Easing, Platform } from 'react-native';`,
    `import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, TextInput, Switch, ActivityIndicator, Linking, Animated, Easing, Platform } from 'react-native';`
  ],
  [
    `import { Card, Badge, Input, Button, useTheme, MobileHeader, HeaderActionItem, KPICard, KPIGrid, FilterToolbar, Text, useTypeStyle } from '../../components/ui';`,
    `import { Card, Badge, Input, Button, useTheme, MobileHeader, HeaderActionItem, KPICard, KPIGrid, FilterToolbar, Text, useTypeStyle, AppModal } from '../../components/ui';`
  ],
  [
    `import * as Haptics from 'expo-haptics';`,
    `import { haptics } from '../../lib/interaction/haptics';`
  ],
  [
    `    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});`,
    `    haptics.success();`
  ],
  [
    `            Haptics.selectionAsync().catch(() => {});`,
    `            haptics.select();`
  ],
  [
    `      {/* Add / Edit Client Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>`,
    `      {/* Add / Edit Client Modal */}
      <AppModal visible={modalVisible} onClose={() => setModalVisible(false)} variant="bottom">
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>`
  ],
  [
    `            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setModalVisible(false)} />
              <Button label={editingClient ? 'Update Client' : 'Save Client'} variant="primary" onPress={handleSave} />
            </View>
          </View>
        </View>
      </Modal>`,
    `            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setModalVisible(false)} />
              <Button label={editingClient ? 'Update Client' : 'Save Client'} variant="primary" onPress={handleSave} />
            </View>
        </View>
      </AppModal>`
  ],
  [
    `      {/* C11 Client Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, maxHeight: '92%' }]}>`,
    `      {/* C11 Client Detail Modal */}
      <AppModal visible={detailModalVisible} onClose={() => setDetailModalVisible(false)} variant="bottom">
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated, maxHeight: '92%' }]}>`
  ],
  [
    `                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>`,
    `                  }}
                />
              )}
            </View>
          </View>
      </View>
    </AppModal>`
  ],
  [
    `      {/* Add Client Site Modal */}
      <Modal visible={siteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>`,
    `      {/* Add Client Site Modal */}
      <AppModal visible={siteModalVisible} onClose={() => setSiteModalVisible(false)} variant="bottom">
        <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>`
  ],
  [
    `            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setSiteModalVisible(false)} disabled={isSavingSite} />
              <Button label={isSavingSite ? 'Saving...' : 'Save Site'} variant="primary" onPress={handleSaveSite} disabled={isSavingSite} />
            </View>
          </View>
        </View>
      </Modal>`,
    `            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setSiteModalVisible(false)} disabled={isSavingSite} />
              <Button label={isSavingSite ? 'Saving...' : 'Save Site'} variant="primary" onPress={handleSaveSite} disabled={isSavingSite} />
            </View>
        </View>
      </AppModal>`
  ]
]);

// 12. apps/mobile/app/(app)/payroll.tsx
replaceInFile('apps/mobile/app/(app)/payroll.tsx', [
  [
    `  Modal,
  Alert,`,
    `  Alert,`
  ],
  [
    `import { MobileHeader, Card, Badge, EmptyState, KPICard, KPIGrid, HighlightText, type HeaderActionItem, Text, useTypeStyle } from '../../components/ui';`,
    `import { MobileHeader, Card, Badge, EmptyState, KPICard, KPIGrid, HighlightText, type HeaderActionItem, Text, useTypeStyle, AppModal } from '../../components/ui';`
  ],
  [
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
  ],
  [
    `              <Text style={{ color: theme.colors.canvas, textAlign: 'center' }}>
                Close Slip
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>`,
    `              <Text style={{ color: theme.colors.canvas, textAlign: 'center' }}>
                Close Slip
              </Text>
            </TouchableOpacity>
          </View>
      </View>
    </AppModal>`
  ],
  [
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
            },
          ]}
        >`
  ],
  [
    `                  {savingStatement ? 'Saving...' : 'Save Statement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>`,
    `                  {savingStatement ? 'Saving...' : 'Save Statement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
      </View>
    </AppModal>`
  ]
]);

console.log('Batch 3 completed successfully!');
