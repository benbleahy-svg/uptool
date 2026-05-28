import { rfqService } from "@uptool/services";

/** Accepts either an rfq_number ("1004") or a UUID. Returns the RFQ or undefined. */
export async function resolveRfq(orgId: string, rfqParam: string) {
  const num = Number.parseInt(rfqParam, 10);
  if (!Number.isNaN(num) && String(num) === rfqParam) {
    return rfqService.findByNumber(orgId, num);
  }
  return rfqService.findById(orgId, rfqParam);
}
