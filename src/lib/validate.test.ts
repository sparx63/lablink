import assert from "node:assert/strict";
import {
  CreateBookingSchema,
  FinePostSchema,
  parseBody,
  sanitizeText,
  SessionBodySchema,
  ValidationError,
} from "./validate";

function main() {
  assert.equal(sanitizeText("  hello\u0000world  ", 20), "helloworld");

  const session = parseBody(SessionBodySchema, { userId: "u-student-1" });
  assert.equal(session.userId, "u-student-1");

  const booking = parseBody(CreateBookingSchema, {
    equipmentId: "eq-fpga",
    start: "2026-12-01T10:00:00.000Z",
    end: "2026-12-01T12:00:00.000Z",
    purpose: "  Lab demo  ",
    usageType: "IN_LAB",
  });
  assert.equal(booking.purpose, "Lab demo");
  assert.equal(booking.usageType, "IN_LAB");

  let threw = false;
  try {
    parseBody(CreateBookingSchema, { equipmentId: "eq-fpga", purpose: "x" });
  } catch (e) {
    threw = e instanceof ValidationError;
  }
  assert.ok(threw, "missing start/end must fail validation");

  const fine = parseBody(FinePostSchema, {
    kind: "incident",
    bookingId: "bk-1",
    type: "DAMAGED",
    description: "Bent connector",
    severity: "MEDIUM",
    fineAmount: 500,
  });
  assert.equal(fine.kind, "incident");

  console.log("validate.test.ts passed");
}

main();
