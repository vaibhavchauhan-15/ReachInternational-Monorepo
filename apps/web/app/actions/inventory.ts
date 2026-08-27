"use server";

import { revalidateTag } from "next/cache";
import { getCurrentUser, requirePermission, requireAnyPermission } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import { logAudit } from "@/lib/audit";
import type { InventoryTransactionType } from "@/lib/types/database";

// ============================================
// 1. PART MASTER CREATION & UPDATES
// ============================================
export async function createOrUpdatePartAction(payload: {
  id?: string;
  part_number: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  manufacturer?: string;
  brand?: string;
  oem_part_number?: string;
  alternate_part_number?: string;
  barcode?: string;
  unit?: string;
  min_stock_level?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  max_stock_level?: number;
  unit_cost?: number;
  last_purchase_price?: number;
  warehouse_zone?: string;
  rack_number?: string;
  shelf_number?: string;
  bin_number?: string;
  compatible_machines?: string;
  compatible_models?: string;
  part_type?: "spare" | "consumable" | "tool" | "assembly" | "lubricant";
  criticality?: "normal" | "high" | "critical";
  notes?: string;
}) {
  const user = await requireAnyPermission("inventory.create", "inventory.edit");
  const supabase = createSupabaseAdminClient();

  const partData = {
    part_number: payload.part_number.trim(),
    name: payload.name.trim(),
    description: payload.description || null,
    category: payload.category || "General",
    subcategory: payload.subcategory || null,
    manufacturer: payload.manufacturer || null,
    brand: payload.brand || null,
    oem_part_number: payload.oem_part_number || null,
    alternate_part_number: payload.alternate_part_number || null,
    barcode: payload.barcode || null,
    unit: payload.unit || "Pcs",
    min_stock_level: payload.min_stock_level ?? 5,
    reorder_level: payload.reorder_level ?? 5,
    reorder_quantity: payload.reorder_quantity ?? 10,
    max_stock_level: payload.max_stock_level ?? 100,
    unit_cost: payload.unit_cost ?? 0,
    last_purchase_price: payload.last_purchase_price ?? payload.unit_cost ?? 0,
    warehouse_zone: payload.warehouse_zone || "ZONE-A",
    rack_number: payload.rack_number || "R-01",
    shelf_number: payload.shelf_number || "S-01",
    bin_number: payload.bin_number || "B-01",
    storage_location: `${payload.warehouse_zone || "ZONE-A"} > ${payload.rack_number || "R-01"} > ${payload.shelf_number || "S-01"} > ${payload.bin_number || "B-01"}`,
    compatible_machines: payload.compatible_machines || null,
    compatible_models: payload.compatible_models || null,
    part_type: payload.part_type || "spare",
    criticality: payload.criticality || "normal",
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  };

  let productResult;
  if (payload.id) {
    const { data, error } = await supabase
      .from("inventory_products")
      .update(partData)
      .eq("id", payload.id)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    productResult = data;
  } else {
    const { data, error } = await supabase
      .from("inventory_products")
      .insert(partData)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    productResult = data;

    // Seed default stock for default branch (HQ)
    const { data: mainBranch } = await supabase.from("branches").select("id").limit(1).single();
    if (mainBranch) {
      await supabase.from("inventory_stock").insert({
        product_id: productResult.id,
        branch_id: mainBranch.id,
        quantity: 0,
      });
    }
  }

  await logAudit({
    user_id: user.id,
    action: payload.id ? "inventory.part_updated" : "inventory.part_created",
    entity_type: "inventory_product",
    entity_id: productResult.id,
    metadata: { part_number: payload.part_number, name: payload.name },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: productResult };
}

// ============================================
// 2. RACK / BIN LOCATION UPDATE
// ============================================
export async function updatePartStorageLocationAction(payload: {
  partId: string;
  warehouseZone: string;
  rackNumber: string;
  shelfNumber: string;
  binNumber: string;
}) {
  const user = await requirePermission("inventory.create");
  const supabase = createSupabaseAdminClient();

  const storage_location = `${payload.warehouseZone} > ${payload.rackNumber} > ${payload.shelfNumber} > ${payload.binNumber}`;

  const { data, error } = await supabase
    .from("inventory_products")
    .update({
      warehouse_zone: payload.warehouseZone,
      rack_number: payload.rackNumber,
      shelf_number: payload.shelfNumber,
      bin_number: payload.binNumber,
      storage_location,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.partId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAudit({
    user_id: user.id,
    action: "inventory.location_relocated",
    entity_type: "inventory_product",
    entity_id: payload.partId,
    metadata: { new_location: storage_location },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
}

// ============================================
// 3. PURCHASE REQUEST CREATION (STORE MANAGER -> SELECTED MANAGER)
// ============================================
export async function createPurchaseRequestAction(payload: {
  branchId: string;
  sentToManagerId: string;
  priority: "normal" | "high" | "urgent";
  reason: string;
  items: Array<{
    productId: string;
    currentStock: number;
    minStock: number;
    requestedQuantity: number;
    unitPrice?: number;
    remarks?: string;
  }>;
}) {
  const user = await requireAnyPermission("inventory.view", "part_request.create");
  const supabase = createSupabaseAdminClient();

  const requestNo = `PR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Insert Purchase Request Header
  const { data: request, error: prErr } = await supabase
    .from("inventory_purchase_requests")
    .insert({
      request_no: requestNo,
      branch_id: payload.branchId,
      requested_by: user.id,
      sent_to_manager_id: payload.sentToManagerId,
      priority: payload.priority,
      reason: payload.reason,
      status: "pending_approval",
    })
    .select()
    .single();

  if (prErr || !request) {
    console.error("Error creating purchase request:", prErr);
    return { success: false, error: prErr?.message || "Failed to create purchase request" };
  }

  // 2. Insert Request Line Items
  const itemsToInsert = payload.items.map((item) => ({
    request_id: request.id,
    product_id: item.productId,
    current_stock: item.currentStock,
    min_stock: item.minStock,
    requested_quantity: item.requestedQuantity,
    approved_quantity: item.requestedQuantity, // Default to requested until manager modifies
    unit: "Pcs",
    estimated_unit_cost: item.unitPrice || 0,
    remarks: item.remarks || null,
  }));

  const { error: itemErr } = await supabase
    .from("inventory_purchase_request_items")
    .insert(itemsToInsert);

  if (itemErr) {
    console.error("Error inserting PR items:", itemErr);
  }

  // 3. Send Notification to Selected Target Manager
  const { data: targetManager } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", payload.sentToManagerId)
    .single();

  if (targetManager) {
    await supabase.from("notifications").insert({
      recipient_id: payload.sentToManagerId,
      alert_type: "today",
      alert_date: new Date().toISOString().split("T")[0],
      channel: "in_app",
      status: "sent",
      payload: {
        title: "New Part Order Purchase Request",
        message: `Store Manager ${user.full_name || "Store Manager"} sent Purchase Request ${requestNo} (${payload.items.length} parts, Priority: ${payload.priority.toUpperCase()}) for your approval.`,
        requestNo,
        requestedBy: user.full_name || user.email,
        sentTo: targetManager.full_name,
        reason: payload.reason,
      },
    });
  }

  await logAudit({
    user_id: user.id,
    action: "inventory.purchase_request_created",
    entity_type: "purchase_request",
    entity_id: request.id,
    metadata: { requestNo, sentToManagerId: payload.sentToManagerId, priority: payload.priority },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: request };
}

// ============================================
// 4. MANAGER APPROVAL / REJECTION
// ============================================
export async function approveOrRejectPurchaseRequestAction(payload: {
  requestId: string;
  status: "approved" | "partially_approved" | "rejected";
  managerRemarks?: string;
  itemApprovals?: Array<{ itemId: string; approvedQuantity: number }>;
}) {
  const user = await requirePermission("inventory.view");
  const supabase = createSupabaseAdminClient();

  const { data: pr, error: fetchErr } = await supabase
    .from("inventory_purchase_requests")
    .select("*, requester:users!requested_by(full_name, email)")
    .eq("id", payload.requestId)
    .single();

  if (fetchErr || !pr) {
    return { success: false, error: "Purchase Request not found" };
  }

  // 1. Update line item approved quantities if partially approved
  if (payload.itemApprovals && payload.itemApprovals.length > 0) {
    for (const item of payload.itemApprovals) {
      await supabase
        .from("inventory_purchase_request_items")
        .update({ approved_quantity: item.approvedQuantity })
        .eq("id", item.itemId);
    }
  }

  // 2. Update Request Status & Approval Details
  const { data: updatedPR, error: updateErr } = await supabase
    .from("inventory_purchase_requests")
    .update({
      status: payload.status,
      manager_remarks: payload.managerRemarks || null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.requestId)
    .select()
    .single();

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // 3. Notify Requesting Store Manager
  if (pr.requested_by) {
    await supabase.from("notifications").insert({
      recipient_id: pr.requested_by,
      alert_type: "today",
      alert_date: new Date().toISOString().split("T")[0],
      channel: "in_app",
      status: "sent",
      payload: {
        title: `Purchase Request ${pr.request_no} ${payload.status.replace("_", " ").toUpperCase()}`,
        message: `Manager ${user.full_name || "Manager"} has ${payload.status.replace("_", " ")} your purchase request ${pr.request_no}. Remarks: ${payload.managerRemarks || "None"}`,
        requestNo: pr.request_no,
      },
    });
  }

  await logAudit({
    user_id: user.id,
    action: `inventory.purchase_request_${payload.status}`,
    entity_type: "purchase_request",
    entity_id: payload.requestId,
    metadata: { requestNo: pr.request_no, status: payload.status },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: updatedPR };
}

// ============================================
// 5. PURCHASE ORDER CREATION
// ============================================
export async function createPurchaseOrderAction(payload: {
  requestId?: string;
  vendorId?: string;
  vendorName: string;
  vendorGstin?: string;
  contactPerson?: string;
  contactPhone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  branchId: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  items: Array<{
    productId?: string;
    partNumber: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountPercent?: number;
    gstPercent?: number;
  }>;
}) {
  const user = await requireAnyPermission("po.create", "inventory.create");
  const supabase = createSupabaseAdminClient();

  const poNumber = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  let subtotal = 0;
  let taxAmount = 0;

  const processedItems = payload.items.map((item) => {
    const qty = item.quantity;
    const price = item.unitPrice;
    const disc = item.discountPercent || 0;
    const gstRate = item.gstPercent || 18;

    const baseAmount = qty * price * (1 - disc / 100);
    const gstAmt = baseAmount * (gstRate / 100);
    const lineTotal = baseAmount + gstAmt;

    subtotal += baseAmount;
    taxAmount += gstAmt;

    return {
      part_number: item.partNumber,
      product_description: item.description,
      product_id: item.productId || null,
      quantity: qty,
      unit: item.unit || "Pcs",
      unit_price: price,
      discount_percent: disc,
      gst_percent: gstRate,
      gst_amount: gstAmt,
      total_amount: lineTotal,
    };
  });

  const grandTotal = subtotal + taxAmount;

  // PO Approval Threshold Logic:
  // Store Manager auto-approve limit: ₹10,000.
  // Higher roles (branch_manager, admin, super_admin) can approve any amount.
  const STORE_MANAGER_THRESHOLD = 10000;
  let isAutoApproved = true;

  if (user.role === "store_manager" && grandTotal > STORE_MANAGER_THRESHOLD) {
    isAutoApproved = false;
  }

  const initialStatus = isAutoApproved ? "approved" : "pending_approval";

  // 1. Create Purchase Order
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      po_number: poNumber,
      request_id: payload.requestId || null,
      vendor_id: payload.vendorId || "v-001",
      vendor_name: payload.vendorName,
      vendor_gstin: payload.vendorGstin || null,
      contact_person: payload.contactPerson || null,
      contact_phone: payload.contactPhone || null,
      billing_address: payload.billingAddress || "REACH INTERNATIONAL, Plot No. 21, Palam Matiala Road, Dwarka, New Delhi-110059",
      shipping_address: payload.shippingAddress || "Reach International, Site Warehouse, Delhi HQ",
      branch_id: payload.branchId,
      amount: grandTotal,
      subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      payment_terms: payload.paymentTerms || "30 Days Net",
      delivery_terms: payload.deliveryTerms || "Door Delivery",
      status: initialStatus,
      requested_by: user.id,
      approved_by: isAutoApproved ? user.id : null,
      approved_at: isAutoApproved ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (poErr || !po) {
    console.error("Error creating PO:", poErr);
    return { success: false, error: poErr?.message || "Failed to create Purchase Order" };
  }

  // Send notification to Branch Manager/Admin if PO exceeds Store Manager threshold
  if (!isAutoApproved) {
    const { data: branchManagers } = await supabase
      .from("users")
      .select("id")
      .in("role", ["branch_manager", "admin", "super_admin"]);

    if (branchManagers && branchManagers.length > 0) {
      const notificationsToInsert = branchManagers.map((mgr) => ({
        recipient_id: mgr.id,
        alert_type: "today" as const,
        alert_date: new Date().toISOString().split("T")[0],
        channel: "in_app" as const,
        status: "sent" as const,
        payload: {
          title: "PO Pending High-Value Approval",
          message: `Purchase Order ${poNumber} (₹${grandTotal.toLocaleString("en-IN")}) exceeds Store Manager approval threshold (₹10,000). Approval required.`,
          poNumber,
          requestedBy: user.full_name || user.email,
          grandTotal,
        },
      }));
      await supabase.from("notifications").insert(notificationsToInsert);
    }
  }

  // 2. Insert PO Line Items
  const poItemsWithId = processedItems.map((item) => ({
    ...item,
    po_id: po.id,
  }));

  await supabase.from("inventory_purchase_order_items").insert(poItemsWithId);

  // 3. Update associated PR status to converted_to_po if applicable
  if (payload.requestId) {
    await supabase
      .from("inventory_purchase_requests")
      .update({ status: "converted_to_po" })
      .eq("id", payload.requestId);
  }

  await logAudit({
    user_id: user.id,
    action: "inventory.purchase_order_created",
    entity_type: "purchase_order",
    entity_id: po.id,
    metadata: { poNumber, vendorName: payload.vendorName, amount: grandTotal },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: po };
}

// ============================================
// 6. GOODS RECEIPT ENTRY (GRN) & INCOMING STOCK
// ============================================
export async function recordGoodsReceiptAction(payload: {
  poId?: string;
  supplierId?: string;
  supplierName: string;
  supplierGstin?: string;
  billNumber: string;
  billDate: string;
  deliveryDate?: string;
  transportDetails?: string;
  billDocumentUrl?: string;
  branchId: string;
  remarks?: string;
  items: Array<{
    productId: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitPrice: number;
    taxAmount?: number;
    rack?: string;
    shelf?: string;
    bin?: string;
    batchNumber?: string;
    serialNumber?: string;
  }>;
}) {
  const user = await requirePermission("inventory.stock_in");
  const supabase = createSupabaseAdminClient();

  const grnNumber = `GRN-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Create Goods Receipt Header
  const { data: grn, error: grnErr } = await supabase
    .from("inventory_goods_receipts")
    .insert({
      grn_number: grnNumber,
      po_id: payload.poId || null,
      supplier_id: payload.supplierId || null,
      supplier_name: payload.supplierName,
      supplier_gstin: payload.supplierGstin || null,
      bill_number: payload.billNumber,
      bill_date: payload.billDate,
      delivery_date: payload.deliveryDate || new Date().toISOString().split("T")[0],
      transport_details: payload.transportDetails || null,
      bill_document_url: payload.billDocumentUrl || null,
      branch_id: payload.branchId,
      received_by: user.id,
      remarks: payload.remarks || null,
    })
    .select()
    .single();

  if (grnErr || !grn) {
    console.error("Error creating Goods Receipt:", grnErr);
    return { success: false, error: grnErr?.message || "Failed to create Goods Receipt" };
  }

  // 2. Insert GRN Items & Process Stock Increments
  for (const item of payload.items) {
    const lineTotal = item.quantityReceived * item.unitPrice + (item.taxAmount || 0);

    await supabase.from("inventory_goods_receipt_items").insert({
      grn_id: grn.id,
      product_id: item.productId,
      quantity_ordered: item.quantityOrdered,
      quantity_received: item.quantityReceived,
      unit_price: item.unitPrice,
      tax_amount: item.taxAmount || 0,
      total_amount: lineTotal,
      rack: item.rack || "R-01",
      shelf: item.shelf || "S-01",
      bin: item.bin || "B-01",
      batch_number: item.batchNumber || null,
      serial_number: item.serialNumber || null,
    });

    // Update storage location on product if provided
    if (item.rack && item.bin) {
      await supabase
        .from("inventory_products")
        .update({
          rack_number: item.rack,
          shelf_number: item.shelf || "S-01",
          bin_number: item.bin,
          storage_location: `ZONE-A > ${item.rack} > ${item.shelf || "S-01"} > ${item.bin}`,
          last_purchase_price: item.unitPrice,
        })
        .eq("id", item.productId);
    }

    // Atomically increment stock quantity
    await createInventoryTransactionAction({
      productId: item.productId,
      branchId: payload.branchId,
      type: "PURCHASE_RECEIPT",
      quantity: item.quantityReceived,
      referenceId: grnNumber,
      remarks: `Goods Receipt ${grnNumber} (Bill #${payload.billNumber}) from ${payload.supplierName}`,
    });
  }

  // Update PO status to received if linked
  if (payload.poId) {
    await supabase
      .from("purchase_orders")
      .update({ status: "received" })
      .eq("id", payload.poId);
  }

  await logAudit({
    user_id: user.id,
    action: "inventory.goods_received",
    entity_type: "goods_receipt",
    entity_id: grn.id,
    metadata: { grnNumber, billNumber: payload.billNumber, supplierName: payload.supplierName },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: grn };
}

// ============================================
// 7. PART ISSUANCE & PARTS ISSUE CHALLAN
// ============================================
export async function createPartIssueAction(payload: {
  branchId: string;
  machineId?: string;
  complaintId?: string;
  issuedToUserId?: string;
  issuedToName: string;
  issueDate?: string;
  isReturnable: boolean;
  expectedReturnDate?: string;
  generateDeliveryChallan?: boolean;
  destinationAddress?: string;
  remarks?: string;
  items: Array<{
    productId: string;
    quantityIssued: number;
    machineCode?: string;
    isReturnable?: boolean;
  }>;
}) {
  const user = await requirePermission("inventory.stock_out");
  const supabase = createSupabaseAdminClient();

  const issueNumber = `PI-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const challanNumber = `2201`; // Document serial format matching reference image

  // 1. Verify stock availability before issuing
  for (const item of payload.items) {
    const { data: stock } = await supabase
      .from("inventory_stock")
      .select("quantity")
      .eq("product_id", item.productId)
      .eq("branch_id", payload.branchId)
      .single();

    const currentQty = stock?.quantity || 0;
    if (currentQty < item.quantityIssued) {
      const { data: prod } = await supabase
        .from("inventory_products")
        .select("name, part_number")
        .eq("id", item.productId)
        .single();

      return {
        success: false,
        error: `Insufficient stock for ${prod?.name || "Part"} (${prod?.part_number}). Available: ${currentQty}, Requested: ${item.quantityIssued}`,
      };
    }
  }

  // 2. Insert Part Issue Header
  const { data: issue, error: issueErr } = await supabase
    .from("inventory_part_issues")
    .insert({
      issue_number: issueNumber,
      challan_number: challanNumber,
      branch_id: payload.branchId,
      machine_id: payload.machineId || null,
      complaint_id: payload.complaintId || null,
      issued_by: user.id,
      issued_to_user_id: payload.issuedToUserId || null,
      issued_to_name: payload.issuedToName,
      issue_date: payload.issueDate || new Date().toISOString().split("T")[0],
      is_returnable: payload.isReturnable,
      expected_return_date: payload.expectedReturnDate || null,
      status: "issued",
      remarks: payload.remarks || null,
    })
    .select()
    .single();

  if (issueErr || !issue) {
    console.error("Error creating Part Issue:", issueErr);
    return { success: false, error: issueErr?.message || "Failed to issue parts" };
  }

  // 3. Insert Issue Items & Deduct Inventory Stock
  for (const item of payload.items) {
    await supabase.from("inventory_part_issue_items").insert({
      issue_id: issue.id,
      product_id: item.productId,
      quantity_issued: item.quantityIssued,
      quantity_returned: 0,
      machine_code: item.machineCode || null,
      is_returnable: item.isReturnable ?? payload.isReturnable,
    });

    // Deduct stock quantity
    await createInventoryTransactionAction({
      productId: item.productId,
      branchId: payload.branchId,
      type: "PART_ISSUE",
      quantity: item.quantityIssued,
      referenceId: challanNumber,
      remarks: `Issued to ${payload.issuedToName} (Challan #${challanNumber}, Issue #${issueNumber})`,
    });
  }

  // 4. Optionally Generate Delivery Challan (RI/DC/XXXX)
  if (payload.generateDeliveryChallan) {
    const dcNumber = `RI/DC/${Math.floor(1000 + Math.random() * 9000)}`;
    const { data: dc } = await supabase
      .from("challans")
      .insert({
        challan_number: dcNumber,
        issue_id: issue.id,
        from_branch_id: payload.branchId,
        from_address: "REACH INTERNATIONAL, PLOT NO. 21, PALAM MATIALA ROAD, DWARKA, NEW DELHI-110059",
        from_gstin: "07AALFR3906M1ZS",
        client_name: payload.issuedToName,
        destination: payload.destinationAddress || "Client Machine Site Location",
        to_customer_name: payload.issuedToName,
        to_address: payload.destinationAddress || "Client Site Address",
        status: "dispatched",
        amount: 40000,
        issue_date: payload.issueDate || new Date().toISOString().split("T")[0],
        note_declaration: "This item is not for sale; it is use for in our own machine.",
        authorised_signatory: "Authorized Signatory",
        pan_no: "AALFR3906M",
      })
      .select()
      .single();

    if (dc) {
      for (const item of payload.items) {
        const { data: prod } = await supabase
          .from("inventory_products")
          .select("name, part_number")
          .eq("id", item.productId)
          .single();

        await supabase.from("inventory_delivery_challan_items").insert({
          challan_id: dc.id,
          product_id: item.productId,
          part_number: prod?.part_number || "PART-001",
          description: prod?.name || "Spare Part",
          quantity: item.quantityIssued,
          unit: "Pcs",
          machine_number: item.machineCode || null,
          issue_to: payload.issuedToName,
          returnable_status: payload.isReturnable ? "RETURNABLE" : "NON-RETURNABLE",
        });
      }
    }
  }

  await logAudit({
    user_id: user.id,
    action: "inventory.part_issued",
    entity_type: "part_issue",
    entity_id: issue.id,
    metadata: { issueNumber, challanNumber, issuedToName: payload.issuedToName },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: issue };
}

// ============================================
// 8. PART RETURN WORKFLOW
// ============================================
export async function recordPartReturnAction(payload: {
  issueId: string;
  returnedByName: string;
  returnDate?: string;
  remarks?: string;
  items: Array<{
    productId: string;
    quantityReturned: number;
    condition: "good" | "damaged" | "scrap";
    remarks?: string;
  }>;
}) {
  const user = await requirePermission("inventory.stock_in");
  const supabase = createSupabaseAdminClient();

  const returnNumber = `RET-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Fetch original issue record
  const { data: issue, error: issueErr } = await supabase
    .from("inventory_part_issues")
    .select("*, items:inventory_part_issue_items(*)")
    .eq("id", payload.issueId)
    .single();

  if (issueErr || !issue) {
    return { success: false, error: "Issue record not found" };
  }

  // 2. Insert Return Header
  const { data: partReturn, error: retErr } = await supabase
    .from("inventory_part_returns")
    .insert({
      return_number: returnNumber,
      issue_id: payload.issueId,
      returned_by_name: payload.returnedByName,
      received_by: user.id,
      return_date: payload.returnDate || new Date().toISOString().split("T")[0],
      remarks: payload.remarks || null,
    })
    .select()
    .single();

  if (retErr || !partReturn) {
    return { success: false, error: retErr?.message || "Failed to log part return" };
  }

  // 3. Process Returned Items & Restore Available Stock for Good Condition Parts
  for (const item of payload.items) {
    await supabase.from("inventory_part_return_items").insert({
      return_id: partReturn.id,
      product_id: item.productId,
      quantity_returned: item.quantityReturned,
      condition: item.condition,
      remarks: item.remarks || null,
    });

    // Update quantity returned on the original issue item record
    const origItem = issue.items?.find((i: any) => i.product_id === item.productId);
    if (origItem) {
      const newReturnedQty = (origItem.quantity_returned || 0) + item.quantityReturned;
      await supabase
        .from("inventory_part_issue_items")
        .update({ quantity_returned: newReturnedQty })
        .eq("id", origItem.id);
    }

    // Only add back to available stock if returned in good condition
    if (item.condition === "good") {
      await createInventoryTransactionAction({
        productId: item.productId,
        branchId: issue.branch_id,
        type: "PART_RETURN",
        quantity: item.quantityReturned,
        referenceId: returnNumber,
        remarks: `Part Return ${returnNumber} from ${payload.returnedByName} (Condition: GOOD)`,
      });
    } else {
      // Log damage/scrap audit entry without increasing available stock
      await createInventoryTransactionAction({
        productId: item.productId,
        branchId: issue.branch_id,
        type: "DAMAGE",
        quantity: item.quantityReturned,
        referenceId: returnNumber,
        remarks: `Part Return ${returnNumber} from ${payload.returnedByName} (Condition: ${item.condition.toUpperCase()})`,
      });
    }
  }

  // Update Issue Status based on remaining unreturned quantities
  const { data: updatedIssueItems } = await supabase
    .from("inventory_part_issue_items")
    .select("quantity_issued, quantity_returned")
    .eq("issue_id", payload.issueId);

  const totalIssued = updatedIssueItems?.reduce((a, b) => a + b.quantity_issued, 0) || 0;
  const totalReturned = updatedIssueItems?.reduce((a, b) => a + b.quantity_returned, 0) || 0;

  const newStatus = totalReturned >= totalIssued ? "fully_returned" : "partially_returned";
  await supabase
    .from("inventory_part_issues")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", payload.issueId);

  await logAudit({
    user_id: user.id,
    action: "inventory.part_returned",
    entity_type: "part_return",
    entity_id: partReturn.id,
    metadata: { returnNumber, issueNumber: issue.issue_number, returnedByName: payload.returnedByName },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: partReturn };
}

// Helper wrapper functions
export async function createInventoryTransactionAction(payload: {
  productId: string;
  branchId: string;
  type: InventoryTransactionType;
  quantity: number;
  referenceId?: string;
  remarks?: string;
}) {
  const user = await requirePermission("inventory.stock_in");
  const supabase = createSupabaseAdminClient();

  const txnNo = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

  const { data: txn, error: txnError } = await supabase
    .from("inventory_transactions")
    .insert({
      transaction_no: txnNo,
      product_id: payload.productId,
      branch_id: payload.branchId,
      type: payload.type,
      quantity: payload.quantity,
      reference_id: payload.referenceId || null,
      user_id: user.id,
      remarks: payload.remarks || null,
    })
    .select()
    .single();

  if (txnError) {
    return { success: false, error: txnError.message };
  }

  let delta = payload.quantity;
  if (["STOCK_OUT", "SERVICE_ISSUE", "PART_ISSUE", "DAMAGE", "LOSS"].includes(payload.type)) {
    delta = -Math.abs(payload.quantity);
  } else {
    delta = Math.abs(payload.quantity);
  }

  const { data: currentStock } = await supabase
    .from("inventory_stock")
    .select("id, quantity")
    .eq("product_id", payload.productId)
    .eq("branch_id", payload.branchId)
    .single();

  const newQty = Math.max(0, (currentStock?.quantity || 0) + delta);

  await supabase
    .from("inventory_stock")
    .upsert(
      {
        product_id: payload.productId,
        branch_id: payload.branchId,
        quantity: newQty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,branch_id" }
    );

  await logAudit({
    user_id: user.id,
    action: `inventory.${payload.type.toLowerCase()}`,
    entity_type: "inventory",
    entity_id: payload.productId,
    metadata: { txnNo, quantity: payload.quantity, type: payload.type, branchId: payload.branchId },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: txn };
}

export async function requestStockTransferAction(payload: {
  fromBranchId: string;
  toBranchId: string;
  productId: string;
  quantity: number;
  remarks?: string;
}) {
  const user = await requirePermission("inventory.transfer");
  const supabase = createSupabaseAdminClient();

  const transferNo = `TR-${Math.floor(100000 + Math.random() * 900000)}`;

  const { data, error } = await supabase
    .from("stock_transfers")
    .insert({
      transfer_no: transferNo,
      from_branch_id: payload.fromBranchId,
      to_branch_id: payload.toBranchId,
      product_id: payload.productId,
      quantity: payload.quantity,
      status: "pending",
      requested_by: user.id,
      remarks: payload.remarks || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAudit({
    user_id: user.id,
    action: "inventory.transfer_requested",
    entity_type: "stock_transfer",
    entity_id: data.id,
    metadata: { transferNo, quantity: payload.quantity },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
}

export async function acceptStockTransferAction(transferId: string) {
  const user = await requirePermission("inventory.transfer");
  const supabase = createSupabaseAdminClient();

  const { data: transfer, error: fetchErr } = await supabase
    .from("stock_transfers")
    .select("*")
    .eq("id", transferId)
    .single();

  if (fetchErr || !transfer) return { success: false, error: "Transfer request not found" };
  if (transfer.status !== "pending") return { success: false, error: `Transfer is already ${transfer.status}` };

  // Deduct from source branch stock
  await createInventoryTransactionAction({
    productId: transfer.product_id,
    branchId: transfer.from_branch_id,
    type: "TRANSFER",
    quantity: transfer.quantity,
    referenceId: transfer.transfer_no,
    remarks: `Transfer out to branch ${transfer.to_branch_id}`,
  });

  // Add to target branch stock
  await createInventoryTransactionAction({
    productId: transfer.product_id,
    branchId: transfer.to_branch_id,
    type: "STOCK_IN",
    quantity: transfer.quantity,
    referenceId: transfer.transfer_no,
    remarks: `Transfer in from branch ${transfer.from_branch_id}`,
  });

  const { data: updated, error: updateErr } = await supabase
    .from("stock_transfers")
    .update({
      status: "accepted",
      accepted_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transferId)
    .select()
    .single();

  if (updateErr) return { success: false, error: updateErr.message };

  await logAudit({
    user_id: user.id,
    action: "inventory.transfer_accepted",
    entity_type: "stock_transfer",
    entity_id: transferId,
    metadata: { transferNo: transfer.transfer_no },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: updated };
}

// ============================================
// 9. PO APPROVAL BY AUTHORIZED MANAGERS
// ============================================
export async function approvePurchaseOrderAction(poId: string) {
  const user = await requireAnyPermission("po.approve", "inventory.create");
  const supabase = createSupabaseAdminClient();

  const { data: po, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("*, requester:users!requested_by(full_name, email)")
    .eq("id", poId)
    .single();

  if (fetchErr || !po) {
    return { success: false, error: "Purchase Order not found" };
  }

  const { data: updatedPO, error: updateErr } = await supabase
    .from("purchase_orders")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId)
    .select()
    .single();

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Notify requesting store manager
  if (po.requested_by) {
    await supabase.from("notifications").insert({
      recipient_id: po.requested_by,
      alert_type: "today",
      alert_date: new Date().toISOString().split("T")[0],
      channel: "in_app",
      status: "sent",
      payload: {
        title: `Purchase Order ${po.po_number} Approved`,
        message: `Manager ${user.full_name || "Manager"} approved Purchase Order ${po.po_number} (₹${(po.grand_total || po.amount || 0).toLocaleString("en-IN")}).`,
        poNumber: po.po_number,
      },
    });
  }

  await logAudit({
    user_id: user.id,
    action: "inventory.purchase_order_approved",
    entity_type: "purchase_order",
    entity_id: poId,
    metadata: { poNumber: po.po_number, amount: po.grand_total || po.amount },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: updatedPO };
}

// ============================================
// 10. PRODUCT ARCHIVING (DEACTIVATION)
// ============================================
export async function archiveProductAction(productId: string) {
  const user = await requireAnyPermission("inventory.archive", "inventory.create");
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("inventory_products")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", productId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await logAudit({
    user_id: user.id,
    action: "inventory.product_archived",
    entity_type: "inventory_product",
    entity_id: productId,
    metadata: { status: "inactive" },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data };
}

// ============================================
// 11. STOCK ADJUSTMENT (DAMAGED, MISSING, CORRECTION)
// ============================================
export async function createStockAdjustmentAction(payload: {
  productId: string;
  branchId: string;
  adjustmentType: "damage" | "missing" | "correction";
  quantity: number;
  reason: string;
  supportingDocUrl?: string;
}) {
  const user = await requireAnyPermission("inventory.adjust", "inventory.create");
  const supabase = createSupabaseAdminClient();

  let txnType: InventoryTransactionType = "ADJUSTMENT";
  if (payload.adjustmentType === "damage") txnType = "DAMAGE";
  if (payload.adjustmentType === "missing") txnType = "LOSS";

  const adjRef = `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const result = await createInventoryTransactionAction({
    productId: payload.productId,
    branchId: payload.branchId,
    type: txnType,
    quantity: payload.quantity,
    referenceId: adjRef,
    remarks: `Stock Adjustment (${payload.adjustmentType.toUpperCase()}): ${payload.reason}`,
  });

  if (result.success) {
    await logAudit({
      user_id: user.id,
      action: `inventory.stock_adjusted_${payload.adjustmentType}`,
      entity_type: "inventory_product",
      entity_id: payload.productId,
      metadata: { adjustmentType: payload.adjustmentType, quantity: payload.quantity, reason: payload.reason, referenceId: adjRef },
    });
  }

  return result;
}

// ============================================
// 12. PURCHASE RETURN TO SUPPLIER
// ============================================
export async function createPurchaseReturnAction(payload: {
  supplierId?: string;
  supplierName: string;
  poId?: string;
  grnId?: string;
  branchId: string;
  remarks?: string;
  items: Array<{
    productId: string;
    quantity: number;
    reason: string;
  }>;
}) {
  const user = await requireAnyPermission("purchase_return.create", "inventory.stock_out");
  const supabase = createSupabaseAdminClient();

  const returnNo = `PRET-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  for (const item of payload.items) {
    await createInventoryTransactionAction({
      productId: item.productId,
      branchId: payload.branchId,
      type: "STOCK_OUT",
      quantity: item.quantity,
      referenceId: returnNo,
      remarks: `Purchase Return ${returnNo} to ${payload.supplierName} (Reason: ${item.reason})`,
    });
  }

  await logAudit({
    user_id: user.id,
    action: "inventory.purchase_return_created",
    entity_type: "purchase_return",
    entity_id: returnNo,
    metadata: { returnNo, supplierName: payload.supplierName, itemsCount: payload.items.length },
  });

  revalidateTag(CACHE_TAGS.machines, "max");
  return { success: true, data: { returnNo } };
}

