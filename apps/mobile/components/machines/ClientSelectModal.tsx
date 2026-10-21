import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useTheme } from '../ui/ThemeProvider';
import { Text, useTypeStyle } from '../ui/Text';
import { AppModal } from '../ui/AppModal';
import { Touchable } from '../ui/Touchable';
import { Pressable } from '../ui/touch/Pressable';
import { SearchInput } from '../ui/SearchInput';
import { haptics } from '../../lib/haptics';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { Check, X, Search, Building2, MapPin, User, Phone } from '../ui/icon';

export interface SelectableClient {
  id: string;
  code?: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  address?: string;
}

export interface ClientSelectModalProps {
  visible: boolean;
  onClose: () => void;
  clients: SelectableClient[];
  selectedClientId?: string | null;
  onSelect: (client: SelectableClient | null) => void;
}

export const ClientSelectModal: React.FC<ClientSelectModalProps> = ({
  visible,
  onClose,
  clients,
  selectedClientId,
  onSelect,
}) => {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const bodyTypeStyle = useTypeStyle('body');
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => {
      return (
        c.company_name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.contact_person?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.state?.toLowerCase().includes(q)
      );
    });
  }, [clients, search]);

  const handleChoose = (client: SelectableClient | null) => {
    onSelect(client);
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      variant={isDesktop ? 'center' : 'bottom'}
      showHandle={false}
      panelStyle={
        isDesktop
          ? {
              maxWidth: 580,
              width: '100%',
              alignSelf: 'center',
              borderRadius: radiusNumeric.lg,
              overflow: 'hidden',
            }
          : {
              maxHeight: '88%',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            }
      }
      testID="client-select-modal"
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.canvasElevated,
          },
        ]}
      >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.hairline }]}>
            <View>
              <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>Assign Client</Text>
              <Text variant="caption" style={[styles.subtitle, { color: theme.colors.mute }]}>
                Select an active client account from CRM
              </Text>
            </View>
            <Touchable
              preset="icon"
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.canvas }]}
            >
              <X size={16} color={theme.colors.mute} />
            </Touchable>
          </View>

          {/* Search Input */}
          <View style={[styles.searchContainer, { borderBottomColor: theme.colors.hairline }]}>
            <SearchInput
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search client by name, city, address..."
              placeholderTextColor={theme.colors.mute}
              autoCorrect={false}
            />
          </View>

          {/* Client List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Clear / Unassign Option */}
            <Pressable
              variant="listRow"
              haptic="select"
              onPress={() => handleChoose(null)}
              style={[
                styles.unassignRow,
                {
                  backgroundColor: theme.colors.canvas,
                  borderColor: theme.colors.hairline,
                },
              ]}
            >
              <Text variant="caption" style={[styles.unassignText, { color: theme.colors.mute }]}>
                ✕ No Client (Unassigned / Available in Yard)
              </Text>
              {!selectedClientId && (
                <Check size={16} color={theme.colors.primary} strokeWidth={2.5} />
              )}
            </Pressable>

            {filteredClients.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Building2 size={28} color={theme.colors.mute} />
                <Text variant="caption" style={[styles.emptyText, { color: theme.colors.mute }]}>
                  No clients found matching &quot;{search}&quot;.
                </Text>
              </View>
            ) : (
              filteredClients.map((c) => {
                const isSelected = selectedClientId === c.id;
                const parts = [c.street, c.city, c.district, c.state, c.pincode].filter(Boolean).map((s) => String(s).trim()).filter(Boolean);
                const location = parts.length > 0 ? parts.join(', ') : (c.address ? String(c.address).trim() : '');
                return (
                  <Pressable
                    key={c.id}
                    variant="listRow"
                    haptic="select"
                    onPress={() => handleChoose(c)}
                    style={[
                      styles.clientCard,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary + '12'
                          : theme.colors.canvas,
                        borderColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.hairline,
                      },
                    ]}
                  >
                    <View style={styles.cardMain}>
                      <View style={styles.cardHeaderRow}>
                        <Text
                          variant="subheading"
                          style={[
                            styles.companyName,
                            { color: isSelected ? theme.colors.primary : theme.colors.ink },
                          ]}
                          numberOfLines={1}
                        >
                          {c.company_name}
                        </Text>
                      </View>

                      {location ? (
                        <View style={styles.metaRow}>
                          <MapPin size={11} color={theme.colors.mute} />
                          <Text variant="caption" style={[styles.metaText, { color: theme.colors.mute }]} numberOfLines={1}>
                            {location}
                          </Text>
                        </View>
                      ) : null}

                      {c.contact_person ? (
                        <View style={styles.metaRow}>
                          <User size={11} color={theme.colors.mute} />
                          <Text variant="caption" style={[styles.metaText, { color: theme.colors.mute }]} numberOfLines={1}>
                            {c.contact_person} {c.phone ? `• ${c.phone}` : ''}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {isSelected && (
                      <View
                        style={[
                          styles.checkBadge,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      >
                        <Check size={13} color={theme.colors.onPrimary} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheet: {
    width: '100%',
    maxHeight: '100%',
    minHeight: 380,
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
  title: {},
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
  searchContainer: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.sm,
    borderBottomWidth: 1,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    paddingHorizontal: spacingNumeric.sm,
    gap: spacingNumeric.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  list: {
    flex: 1,
    paddingHorizontal: spacingNumeric.md,
  },
  listContent: {
    paddingVertical: spacingNumeric.sm,
    gap: spacingNumeric.xs,
  },
  unassignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: spacingNumeric.xs,
    minHeight: 44,
  },
  unassignText: {},
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacingNumeric.sm,
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    minHeight: 56,
  },
  cardMain: {
    flex: 1,
    paddingRight: spacingNumeric.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
    marginBottom: 3,
  },
  companyName: {
    flex: 1,
  },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  codeText: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {},
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    padding: spacingNumeric.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacingNumeric.sm,
  },
  emptyText: {
    textAlign: 'center',
  },
});
