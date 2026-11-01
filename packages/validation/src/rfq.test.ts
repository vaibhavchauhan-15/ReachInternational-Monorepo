import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rfqSubmissionSchema,
  rfqItemSchema,
  rfqStatusUpdateSchema,
} from "./rfq.ts";

test("rfqItemSchema validates rental duration and item identity", () => {
  // Valid rental item
  const validRental = rfqItemSchema.safeParse({
    requirement_type: "rental",
    custom_description: "14m Electric Articulating Boom Lift",
    quantity: 2,
    duration_value: 3,
    duration_unit: "month",
  });
  assert.equal(validRental.success, true);

  // Rental missing duration
  const invalidRental = rfqItemSchema.safeParse({
    requirement_type: "rental",
    custom_description: "14m Electric Boom Lift",
    quantity: 1,
  });
  assert.equal(invalidRental.success, false);

  // Valid purchase item without duration
  const validPurchase = rfqItemSchema.safeParse({
    requirement_type: "purchase",
    custom_description: "JCB Telehandler 540-170",
    quantity: 1,
  });
  assert.equal(validPurchase.success, true);
});

test("rfqSubmissionSchema validates complete valid submission", () => {
  const result = rfqSubmissionSchema.safeParse({
    company_name: "Larsen & Toubro Ltd",
    gstin: "07AAACL1234A1Z5",
    full_name: "Vikram Malhotra",
    email: "vikram@lntecc.test",
    phone: "+91 98765 43210",
    project_city: "Noida",
    project_state_code: "UP",
    items: [
      {
        requirement_type: "rental",
        custom_description: "Scissor Lift 12m",
        quantity: 2,
        duration_value: 1,
        duration_unit: "month",
      },
    ],
    consent: true,
  });
  assert.equal(result.success, true);
});

test("rfqSubmissionSchema rejects missing consent", () => {
  const result = rfqSubmissionSchema.safeParse({
    company_name: "Larsen & Toubro Ltd",
    full_name: "Vikram Malhotra",
    email: "vikram@lntecc.test",
    phone: "9876543210",
    project_city: "Noida",
    project_state_code: "UP",
    items: [
      {
        requirement_type: "purchase",
        custom_description: "Boom Lift",
        quantity: 1,
      },
    ],
    consent: false,
  });
  assert.equal(result.success, false);
});
