import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, Switch } from 'react-native';
import { Card, Badge, Input, Button, useTheme, MobileHeader } from '../../components/ui';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Search, Building2, MapPin, Phone, Mail, Plus, Edit2, Trash2, X, CheckCircle2, ShieldAlert, ReceiptText } from 'lucide-react-native';

export type StatusFilter = 'all' | 'active' | 'inactive';

interface ClientItem {
  id: string;
  code: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  gstin?: string;
  pan_number?: string;
  address: string;
  city: string;
  district?: string;
  state: string;
  pincode?: string;
  is_billing_address_different?: boolean;
  billing_address?: string;
  billing_city?: string;
  billing_district?: string;
  billing_state?: string;
  billing_pincode?: string;
  status: 'active' | 'inactive';
  deleted_at?: string | null;
}

const INITIAL_CLIENTS: ClientItem[] = [
  {
    id: 'cli-001',
    code: 'CLI-0001',
    company_name: 'Pushpa Infracon Pvt Ltd',
    contact_person: 'Rajesh Sharma',
    phone: '+91 98765 43210',
    gstin: '07AAAAA0000A1Z5',
    pan_number: 'ABCDE1234F',
    address: 'Plot 12, Industrial Area Phase 2',
    city: 'Delhi',
    district: 'New Delhi',
    state: 'Delhi',
    status: 'active',
  },
  {
    id: 'cli-002',
    code: 'CLI-0002',
    company_name: 'ABC Infrastructure Ltd',
    contact_person: 'Suresh Kumar',
    phone: '+91 98123 45678',
    gstin: '06BBBBB0000B1Z6',
    address: 'Sector 34, Cyber City Phase 1',
    city: 'Gurgaon',
    district: 'Gurugram',
    state: 'Haryana',
    status: 'active',
  },
  {
    id: 'cli-003',
    code: 'CLI-0003',
    company_name: 'Global Logistics Hub',
    contact_person: 'Anil Patel',
    phone: '+91 99887 76655',
    address: 'Plot 9, Logistics Park, Ecotech 3',
    city: 'Noida',
    district: 'Gautam Buddha Nagar',
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
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  // Conditional Billing Address
  const [isBillingAddressDifferent, setIsBillingAddressDifferent] = useState(false);
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingDistrict, setBillingDistrict] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPincode, setBillingPincode] = useState('');

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
      c.company_name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q)) ||
      (c.pan_number && c.pan_number.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.district && c.district.toLowerCase().includes(q)) ||
      (c.state && c.state.toLowerCase().includes(q)) ||
      (c.billing_address && c.billing_address.toLowerCase().includes(q)) ||
      (c.billing_city && c.billing_city.toLowerCase().includes(q));

    const matchesStatus = activeFilter === 'all' || c.status === activeFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingClient(null);
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setGstin('');
    setPanNumber('');
    setAddress('');
    setCity('');
    setDistrict('');
    setStateName('');
    setPincode('');
    setIsBillingAddressDifferent(false);
    setBillingAddress('');
    setBillingCity('');
    setBillingDistrict('');
    setBillingState('');
    setBillingPincode('');
    setModalVisible(true);
  };

  const handleOpenEdit = (client: ClientItem) => {
    setEditingClient(client);
    setCompanyName(client.company_name);
    setContactPerson(client.contact_person || '');
    setPhone(client.phone || '');
    setGstin(client.gstin || '');
    setPanNumber(client.pan_number || '');
    setAddress(client.address || '');
    setCity(client.city || '');
    setDistrict(client.district || '');
    setStateName(client.state || '');
    setPincode(client.pincode || '');
    setIsBillingAddressDifferent(Boolean(client.is_billing_address_different));
    setBillingAddress(client.billing_address || '');
    setBillingCity(client.billing_city || '');
    setBillingDistrict(client.billing_district || '');
    setBillingState(client.billing_state || '');
    setBillingPincode(client.billing_pincode || '');
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!companyName.trim()) {
      Alert.alert('Validation Error', 'Please enter a valid company name.');
      return;
    }

    if (!address.trim() || !city.trim() || !stateName.trim()) {
      Alert.alert('Validation Error', 'Address, City, and State are required fields.');
      return;
    }

    if (editingClient) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingClient.id
            ? {
                ...c,
                company_name: companyName.trim(),
                contact_person: contactPerson.trim(),
                phone: phone.trim(),
                gstin: gstin.trim().toUpperCase(),
                pan_number: panNumber.trim().toUpperCase(),
                address: address.trim(),
                city: city.trim(),
                district: district.trim(),
                state: stateName.trim(),
                pincode: pincode.trim(),
                is_billing_address_different: isBillingAddressDifferent,
                billing_address: isBillingAddressDifferent ? billingAddress.trim() : undefined,
                billing_city: isBillingAddressDifferent ? billingCity.trim() : undefined,
                billing_district: isBillingAddressDifferent ? billingDistrict.trim() : undefined,
                billing_state: isBillingAddressDifferent ? billingState.trim() : undefined,
                billing_pincode: isBillingAddressDifferent ? billingPincode.trim() : undefined,
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
        company_name: companyName.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        gstin: gstin.trim().toUpperCase(),
        pan_number: panNumber.trim().toUpperCase(),
        address: address.trim(),
        city: city.trim(),
        district: district.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        is_billing_address_different: isBillingAddressDifferent,
        billing_address: isBillingAddressDifferent ? billingAddress.trim() : undefined,
        billing_city: isBillingAddressDifferent ? billingCity.trim() : undefined,
        billing_district: isBillingAddressDifferent ? billingDistrict.trim() : undefined,
        billing_state: isBillingAddressDifferent ? billingState.trim() : undefined,
        billing_pincode: isBillingAddressDifferent ? billingPincode.trim() : undefined,
        status: 'active',
      };
      setClients([newClient, ...clients]);
    }
    setModalVisible(false);
  };

  const handleSoftDelete = (client: ClientItem) => {
    Alert.alert(
      'Soft Delete Client?',
      `Are you sure you want to soft delete "${client.company_name}"? Historical logs will remain 100% intact.`,
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
              placeholder="Search clients, GST, PAN, city..."
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
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.codeText, { color: theme.colors.primary }]}>{item.code}</Text>
                    <Text style={[styles.clientName, { color: theme.colors.ink }]}>{item.company_name}</Text>
                    {(item.gstin || item.pan_number) && (
                      <View style={styles.tagRow}>
                        {item.gstin ? (
                          <View style={[styles.taxBadge, { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }]}>
                            <Text style={[styles.taxBadgeText, { color: '#7e22ce' }]}>GST: {item.gstin}</Text>
                          </View>
                        ) : null}
                        {item.pan_number ? (
                          <View style={[styles.taxBadge, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
                            <Text style={[styles.taxBadgeText, { color: '#0369a1' }]}>PAN: {item.pan_number}</Text>
                          </View>
                        ) : null}
                      </View>
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
                    Location: <Text style={{ fontWeight: '600' }}>{[item.city, item.district, item.state].filter(Boolean).join(', ') || '—'}</Text>
                  </Text>
                  {item.is_billing_address_different && (
                    <Text style={[styles.detailRow, { color: '#d97706', fontWeight: '600' }]}>
                      Billing: {[item.billing_city, item.billing_state].filter(Boolean).join(', ') || 'Separate Address'}
                    </Text>
                  )}
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

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>Company & Tax Details</Text>
                
                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Company Name *</Text>
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="e.g. Pushpa Infracon Pvt Ltd"
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

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>GSTIN Number</Text>
                    <TextInput
                      value={gstin}
                      onChangeText={(t) => setGstin(t.toUpperCase())}
                      placeholder="07AAAAA0000A1Z5"
                      placeholderTextColor={theme.colors.mute}
                      autoCapitalize="characters"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>PAN Number</Text>
                    <TextInput
                      value={panNumber}
                      onChangeText={(t) => setPanNumber(t.toUpperCase())}
                      placeholder="ABCDE1234F"
                      placeholderTextColor={theme.colors.mute}
                      autoCapitalize="characters"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.mute }]}>Site Address</Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Site Address *</Text>
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. Plot 42, Sector 18, Industrial Area"
                    placeholderTextColor={theme.colors.mute}
                    style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>City *</Text>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g. Pune"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>District</Text>
                    <TextInput
                      value={district}
                      onChangeText={setDistrict}
                      placeholder="e.g. Pune"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>State *</Text>
                    <TextInput
                      value={stateName}
                      onChangeText={setStateName}
                      placeholder="e.g. Maharashtra"
                      placeholderTextColor={theme.colors.mute}
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Pincode</Text>
                    <TextInput
                      value={pincode}
                      onChangeText={setPincode}
                      placeholder="411001"
                      placeholderTextColor={theme.colors.mute}
                      keyboardType="numeric"
                      style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.toggleRow}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.mute, marginBottom: 0 }]}>Billing Address</Text>
                  <View style={styles.switchWrapper}>
                    <Text style={[styles.switchLabel, { color: theme.colors.ink }]}>Different Address</Text>
                    <Switch
                      value={isBillingAddressDifferent}
                      onValueChange={setIsBillingAddressDifferent}
                      trackColor={{ false: theme.colors.hairline, true: theme.colors.primary }}
                    />
                  </View>
                </View>

                {isBillingAddressDifferent && (
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.formGroup}>
                      <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Billing Address</Text>
                      <TextInput
                        value={billingAddress}
                        onChangeText={setBillingAddress}
                        placeholder="e.g. Corporate HQ, Tower B, Cyber City"
                        placeholderTextColor={theme.colors.mute}
                        style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                      />
                    </View>

                    <View style={styles.rowInputs}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>City</Text>
                        <TextInput
                          value={billingCity}
                          onChangeText={setBillingCity}
                          placeholder="e.g. Gurugram"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>District</Text>
                        <TextInput
                          value={billingDistrict}
                          onChangeText={setBillingDistrict}
                          placeholder="e.g. Gurugram"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                        />
                      </View>
                    </View>

                    <View style={styles.rowInputs}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>State</Text>
                        <TextInput
                          value={billingState}
                          onChangeText={setBillingState}
                          placeholder="e.g. Haryana"
                          placeholderTextColor={theme.colors.mute}
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                        />
                      </View>

                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.fieldLabel, { color: theme.colors.ink }]}>Pincode</Text>
                        <TextInput
                          value={billingPincode}
                          onChangeText={setBillingPincode}
                          placeholder="122002"
                          placeholderTextColor={theme.colors.mute}
                          keyboardType="numeric"
                          style={[styles.modalInput, { borderColor: theme.colors.hairline, color: theme.colors.ink }]}
                        />
                      </View>
                    </View>
                  </View>
                )}
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
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  taxBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  taxBadgeText: { fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },
  subText: { fontSize: 10 },
  cardDetails: { borderTopWidth: 1, paddingTop: 8, gap: 4 },
  detailRow: { fontSize: 11 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, minHeight: 44 },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacingNumeric.md },
  modalContent: { borderRadius: radiusNumeric.lg, padding: spacingNumeric.md, gap: spacingNumeric.sm, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 15, fontWeight: '800' },
  formSection: { marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10 },
  sectionTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  formGroup: { marginBottom: 8 },
  rowInputs: { flexDirection: 'row', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  modalInput: { borderWidth: 1, borderRadius: radiusNumeric.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { fontSize: 11, fontWeight: '600' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
