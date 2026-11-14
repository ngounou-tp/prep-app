import { describe, expect, it } from "vitest";
import { formErrors } from "@/lib/client/meetingForm";
import { addSubject, companySuggestions, describeSubject, removeSubject } from "@/lib/client/subjectList";
import { briefingInputSchema } from "@/lib/types";
import { company, person } from "@/tests/support/briefingFixture";

describe("subject list rules", () => {
  it("adds a trimmed subject and keeps a person's company", () => {
    const result = addSubject([], { name: "  Amara Diallo ", type: "person", company: " Northwind Freight " }, "s1");
    expect(result).toMatchObject({ ok: true, added: { id: "s1", name: "Amara Diallo", company: "Northwind Freight" } });
  });

  it("rejects an empty name and a duplicate by name and type, ignoring case and spaces", () => {
    expect(addSubject([], { name: "  ", type: "company", company: "" }, "s1")).toMatchObject({ ok: false, field: "name" });
    const duplicate = addSubject([company("s1", "Northwind Freight")], { name: "northwind   FREIGHT", type: "company", company: "" }, "s2");
    expect(duplicate).toEqual({ ok: false, field: "name", message: "northwind   FREIGHT is already in the list." });
    expect(addSubject([company("s1", "Northwind Freight")], { name: "Northwind Freight", type: "person", company: "" }, "s2").ok).toBe(true);
  });

  it("stops at five", () => {
    const five = ["A", "B", "C", "D", "E"].map((letter, index) => company(`s${index + 1}`, `Company ${letter}`));
    expect(addSubject(five, { name: "Company F", type: "company", company: "" }, "s6")).toMatchObject({ ok: false });
  });

  it("moves focus to the next row after a removal, or to the name field after the last", () => {
    const list = [company("s1", "Alpha Example"), company("s2", "Bravo Example")];
    expect(removeSubject(list, "s1").focusId).toBe("s2");
    expect(removeSubject(list, "s2").focusId).toBeNull();
  });

  it("suggests companies already on the list, once each", () => {
    const list = [company("s1", "Northwind Freight"), person("s2", "Amara Diallo", "northwind freight"), person("s3", "Jonas Weber", "Harbor Capital")];
    expect(companySuggestions(list)).toEqual(["Northwind Freight", "Harbor Capital"]);
    expect(describeSubject(list[1])).toBe("Person · northwind freight");
  });
});

describe("formErrors", () => {
  it("explains what is missing in words, one message per field", () => {
    const parsed = briefingInputSchema.safeParse({ meetingAt: "", meetingType: "sales-call", subjects: [] });
    expect(parsed.success).toBe(false);
    expect(formErrors(parsed.error?.issues ?? [], "")).toEqual({
      subjects: "Add at least one person or company.",
      meetingAt: "Choose the date and time of the meeting.",
    });
    expect(formErrors(parsed.error?.issues ?? [], "Northwind").subjects).toBe("Press Add to put Northwind on the list.");
  });
});
