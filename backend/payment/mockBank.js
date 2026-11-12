// TEST PAYMENT ONLY (SCRUM-34). No real bank is contacted and no money moves.
// Deterministic so the demo and the tests can show both outcomes:
//   card number 4000 0000 0000 0002  -> declined ("card_declined")
//   any other Luhn-valid number      -> approved
// The bank never keeps the full card number or the CVV; it only returns a
// reference and the last four digits for display.
const crypto = require("node:crypto");

const DECLINED_CARD = "4000000000000002";

function createMockBank() {
  // reference -> { amountMinor, status: "captured" | "voided" }; kept in memory for the demo
  const charges = new Map();

  return {
    // card: { number, expiryMonth, expiryYear, cvv, holderName } (already validated)
    async charge({ amountMinor, card }) {
      if (card.number === DECLINED_CARD) {
        return { approved: false, reason: "card_declined" };
      }
      const reference = `MOCK-${crypto.randomUUID()}`;
      charges.set(reference, { amountMinor, status: "captured" });
      return { approved: true, reference, cardLast4: card.number.slice(-4) };
    },

    // Gives the money back when the order could not be created after a successful charge
    async void(reference) {
      const charge = charges.get(reference);
      if (charge) charge.status = "voided";
    },

    // For tests and debugging only
    capturedCount() {
      return [...charges.values()].filter((c) => c.status === "captured").length;
    },
  };
}

module.exports = { createMockBank, DECLINED_CARD };
