import { describe, test, expect } from "vitest";
import { parseSignatureCompany, domainToName } from "../derive-customer-name";

describe("parseSignatureCompany", () => {
  test("finds GmbH after -- separator", () => {
    const body = [
      "Hello, please find the attached drawing.",
      "",
      "--",
      "Test User",
      "Test GmbH Manufacturing",
      "Tel: +49 89 12345",
    ].join("\n");
    expect(parseSignatureCompany(body)).toBe("Test GmbH Manufacturing");
  });

  test("finds GmbH after 'Mit freundlichen Grüßen'", () => {
    const body = [
      "Anbei sende ich Ihnen die Anfrage.",
      "",
      "Mit freundlichen Grüßen",
      "Jörg Bremer",
      "Bremer Fertigung GmbH",
    ].join("\n");
    expect(parseSignatureCompany(body)).toBe("Bremer Fertigung GmbH");
  });

  test("finds GmbH & Co. KG variant", () => {
    const body = [
      "Dear Sir,",
      "",
      "Best regards",
      "Max Müller",
      "Alpha Components GmbH & Co. KG",
    ].join("\n");
    expect(parseSignatureCompany(body)).toBe("Alpha Components GmbH & Co. KG");
  });

  test("falls back to last 10 lines when no marker present", () => {
    const lines = [
      "Some email content here.",
      "More content.",
      "Even more.",
      "Line 4",
      "Line 5",
      "Line 6",
      "Line 7",
      "Line 8",
      "Line 9",
      "Jane Doe",
      "Precision Parts AG",
    ];
    const body = lines.join("\n");
    expect(parseSignatureCompany(body)).toBe("Precision Parts AG");
  });

  test("cleans up leading dashes", () => {
    const body = ["--", "- Apex Machining GmbH"].join("\n");
    expect(parseSignatureCompany(body)).toBe("Apex Machining GmbH");
  });

  test("returns null when no legal-form anchor found", () => {
    const body = [
      "Hi,",
      "Please quote these parts.",
      "",
      "-- ",
      "John Smith",
      "Senior Buyer",
    ].join("\n");
    expect(parseSignatureCompany(body)).toBeNull();
  });

  test("returns null for empty body", () => {
    expect(parseSignatureCompany("")).toBeNull();
  });

  test("finds Ltd. anchor", () => {
    const body = ["Best regards", "Sarah Connor", "TerminatorParts Ltd."].join("\n");
    expect(parseSignatureCompany(body)).toBe("TerminatorParts Ltd.");
  });
});

describe("domainToName", () => {
  test("hyphenated domain", () => {
    expect(domainToName("bremer-fertigung.de")).toBe("Bremer Fertigung");
  });

  test("multi-segment domain", () => {
    expect(domainToName("apex-machining.com")).toBe("Apex Machining");
  });

  test("single-word domain", () => {
    expect(domainToName("bosch.de")).toBe("Bosch");
  });

  test("compound TLD co.uk", () => {
    expect(domainToName("precision-parts.co.uk")).toBe("Precision Parts");
  });

  test("subdomain stripped", () => {
    expect(domainToName("mail.example.com")).toBe("Example");
  });
});
