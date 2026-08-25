import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Search, Building2, MapPin, Phone, Mail, Plus, Edit2, Trash2, X, CheckCircle2, ShieldAlert } from 'lucide-react-native';

export type StatusFilter = 'all' | 'active' | 'inactive';

interface ClientItem {
  id: string;
  code: string;
  client_name: string;
  company_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  city: string;
  state: string;
  status: 'active' | 'inactive';
  deleted_at?: string | null;
}

const INITIAL_CLIENTS: ClientItem[] = [
  {
    id: 'cli-001',
    code: 'CLI-0001',
    client_name: 'Pushpa Infracon Pvt Ltd',
    company_name: 'Pushpa Group',
    contact_person: 'Rajesh Sharma',
    phone: '+91 98765 43210',
    email: 'info@pushpainfra.com',
    gstin: '07AAAAA0000A1Z5',
    city: 'Delhi',
    state: 'Delhi',
    status: 'active',
  },
  {
    id: 'cli-002',
    code: 'CLI-0002',
    client_name: 'ABC Infrastructure Ltd',
    company_name: 'ABC Corp',
    contact_person: 'Suresh Kumar',
    phone: '+91 98123 45678',
    email: 'contact@abcinfra.com',
    gstin: '07BBBBB1111B1Z2',
    city: 'Gurgaon',
    state: 'Haryana',
    status: 'active',
  },
  {
    id: 'cli-003',
    code: 'CLI-0003',
    client_name: 'Global Logistics Hub',
    company_name: 'Global Corp',
    contact_person: 'Anil Patel',
    phone: '+91 99887 76655',
    email: 'ops@globallogistics.in',
    gstin: '07CCCCC2222C1Z9',
    city: 'Noida',
    state: 'Uttar Pradesh',
    status: 'inactive',
  },
];

export default function ClientsScreen() {
  const { theme } = useTheme();

  const [clients, setClients] = useState<ClientItem[]>(INITIAL_CLIENTS);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [city, setCity] = useState('Delhi');

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.client_name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      c.city.toLowerCase().includes(q);

    const matchesStatus = activeFilter === 'all' || c.status === activeFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingClient(null);
    setClientName('');
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setGstin('');
    setCity('Delhi');
    setModalVisible(true);
  };

  const handleOpenEdit = (client: ClientItem) => {
    setEditingClient(client);
    setClientName(client.client_name);
    setCompanyName(client.company_name || '');
    setContactPerson(client.contact_person || '');
    setPhone(client.phone || '');
    setEmail(client.email || '');
    setGstin(client.gstin || '');
    setCity(client.city);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!clientName.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid client name.');
      return;
    }

    if (editingClient) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingClient.id
            ? {
                ...c,
                client_name: clientName,
                company_name: companyName,
                contact_person: contactPerson,
                phone,
                email,
                gstin,
                city,
              }
            : c
        )
      );
    } else {
      const nextNum = clients.length + 1;
      const code = `CLI-${nextNum.toString().padStart(4, '0')}`;
      const newClient: ClientItem = {
        id: `cli-${Date.now()}`,
        code,
        client_name: clientName,
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        email,
        gstin,
        city,
        state: 'Delhi',
        status: 'active',
      };
      setClients([newClient, ...clients]);
    }
    setModalVisible(false);
  };

  const handleSoftDelete = (client: ClientItem) => {
    Alert.alert(
      'Soft Delete Client?',
      `Are you sure you want to soft delete "${client.client_name}"? Historical logs will remain 100% intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Soft Delete',
          style: 'destructive',
          onPress: () => {
            setClients((prev) =>
              prev.map((c) => (c.id === client.id ? { ...c, status: 'inactive', deleted_at: new Date().toISOString() } : c))
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <MobileHeader title="Client Directory" showBack={false} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* KPI Summary Cards */}
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Total Clients</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.ink }]}>{clients.length}</Text>
          </Card>
          <Card style={styles.kpiCard}>
            <Text style={[styles.kpiLabel, { color: theme.colors.mute }]}>Active</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.success }]}>
              {clients.filter((c) => c.status === 'active').length}
            </Text>
          </Card>
        </View>

        {/* Search & Add CTA */}
        <View style={styles.actionRow}>
          <View style={styles.searchContainer}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search clients..."
              leftIcon={<Search size={16} color={theme.colors.mute} />}
            />
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.colors.primary }]} onPress={handleOpenAdd}>
            <Plus size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Filter Strip */}
        <View style={styles.filterStrip}>
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                  },
                ]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isActive ? '#ffffff' : theme.colors.ink },
                  ]}
                >
                  {filter.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Client Cards List */}
        <View style={styles.listContainer}>
          {filteredClients.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Building2 size={32} color={theme.colors.mute} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyText, { color: theme.colors.mute }]}>No client records found.</Text>
            </Card>
          ) : (
            filteredClients.map((item) => (
              <Card key={item.id} style={styles.clientCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={[styles.codeText, { color: theme.colors.primary }]}>{item.code}</Text>
                    <Text style={[styles.clientName, { color: theme.colors.ink }]}>{item.client_name}</Text>
                    {item.company_name && (
                      <Text style={[styles.subText, { color: theme.colors.mute }]}>{item.company_name}</Text>
                    )}
                  </View>
                  <Badge
                    status={item.deleted_at ? 'inactive' : item.status}
                    customLabel={item.deleted_at ? 'SOFT DELETED' : item.status.toUpperCase()}
                  />
                </View>

                <View style={[styles.cardDetails, { borderTopColor: theme.colors.hairline }]}>
                  {item.contact_person && (
                    <Text style={[styles.detailRow, { color: theme.colors.ink }]}>
                      Person: <Text style={{ fontWeight: '600' }}>{item.contact_person}</Text>
                    </Text>
                  )}
                  {item.phone && (
                    <Text style={[styles.detailRow, { color: theme.colors.ink }]}>
                      Phone: <Text style={{ fontFamily: 'monospace' }}>{item.phone}</Text>
                    </Text>
                  )}
                  <Text style={[styles.detailRow, { color: theme.colors.ink }]}>
                    Location: <Text style={{ fontWeight: '600' }}>{item.city}, {item.state}</Text>
                  </Text>
                </View>

                {/* Touch Actions */}
                <View style={[styles.cardActions, { borderTopColor: theme.colors.hairline }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.colors.canvas }]}
                    onPress={() => handleOpenEdit(item)}
                  >
                    <Edit2 size={14} color={theme.colors.primary} />
                    <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
                    onPress={() => handleSoftDelete(item)}
                  >
                    <Trash2 size={14} color="#dc2626" />
                    <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Soft Delete</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add / Edit Client Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.canvasElevated }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.ink }]}>
                {editingClient ? `Edit (${editingClient.code})` : 'Add New Client'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={theme.colors.mute} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Client Name *</Text>
                <TextInput
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="e.g. Pushpa Infracon"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Contact Person</Text>
                <TextInput
                  value={contactPerson}
                  onChangeText={setContactPerson}
                  placeholder="e.g. Rajesh Sharma"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. +91 98765 43210"
                  placeholderTextColor={theme.colors.mute}
                  keyboardType="phone-pad"
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>City</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="Delhi"
                  placeholderTextColor={theme.colors.mute}
                  style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button label="Cancel" variant="outline" onPress={() => setModalVisible(false)} />
              <Button label={editingClient ? 'Update Client' : 'Save Client'} variant="primary" onPress={handleSave} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacingNumeric.md },
  kpiRow: { flexDirection: 'row', gap: spacingNumeric.sm, marginBottom: spacingNumeric.md },
  kpiCard: { flex: 1, padding: spacingNumeric.sm, borderRadius: radiusNumeric.md },
  kpiLabel: { fontSize: 11, fontWeight: '500' },
  kpiValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacingNumeric.sm, marginBottom: spacingNumeric.sm },
  searchContainer: { flex: 1 },
  addBtn: { width: 44, height: 44, borderRadius: radiusNumeric.md, justifyContent: 'center', alignItems: 'center' },
  filterStrip: { flexDirection: 'row', gap: spacingNumeric.xs, marginBottom: spacingNumeric.md },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radiusNumeric.full, borderWidth: 1 },
  filterChipText: { fontSize: 10, fontWeight: '700' },
  listContainer: { gap: spacingNumeric.sm },
  emptyCard: { padding: spacingNumeric.lg, alignItems: 'center' },
  emptyText: { fontSize: 12, fontWeight: '600' },
  clientCard: { padding: spacingNumeric.md, borderRadius: radiusNumeric.md, gap: spacingNumeric.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  codeText: { fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
  clientName: { fontSize: 14, fontWeight: '800' },
  subText: { fontSize: 10 },
  cardDetails: { borderTopWidth: 1, paddingTop: 8, gap: 4 },
  detailRow: { fontSize: 11 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, minHeight: 44 },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacingNumeric.md },
  modalContent: { borderRadius: radiusNumeric.lg, padding: spacingNumeric.md, gap: spacingNumeric.sm },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 15, fontWeight: '800' },
  formGroup: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  modalInput: { borderWidth: 1, borderRadius: radiusNumeric.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
