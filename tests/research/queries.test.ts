import { describe, expect, it } from "vitest";
import { buildQueries, planSearches, searchBudget, searchedTopics } from "@/lib/research/queries";
import { makeSubject } from "@/tests/support/testDoubles";

const company = makeSubject("c1", "Northwind Freight", "company");
const person = makeSubject("p1", "Amara Diallo", "person");

describe("buildQueries", () => {
  it("builds five quoted queries for a company, one per angle", () => {
    const queries = buildQueries(company, 5);
    expect(queries).toHaveLength(5);
    expect(queries.every((query) => query.text.startsWith('"Northwind Freight" '))).toBe(true);
    expect(queries.map((query) => query.topic)).toEqual(["news", "news", "news", "general", "news"]);
    expect(queries.map((query) => query.text).join(" | ")).toMatch(/news.*leadership.*funding.*product.*lawsuit/);
  });

  it("builds four quoted queries for a person", () => {
    const queries = buildQueries(person, 4);
    expect(queries).toHaveLength(4);
    expect(queries.every((query) => query.text.startsWith('"Amara Diallo" '))).toBe(true);
  });

  it("adds a person's company, quoted, to every query", () => {
    const employee = makeSubject("p1", "Amara Diallo", "person", { company: "Northwind Freight" });
    const queries = buildQueries(employee, 4);
    expect(queries.every((query) => query.text.startsWith('"Amara Diallo" "Northwind Freight" '))).toBe(true);
  });

  it("appends the context to every query", () => {
    const withContext = makeSubject("c1", "Northwind Freight", "company", { context: "cold-chain logistics Rotterdam" });
    const queries = buildQueries(withContext, 5);
    expect(queries.every((query) => query.text.endsWith(" cold-chain logistics Rotterdam"))).toBe(true);
  });

  it("strips double quotes from user input so the name stays one phrase", () => {
    const quoted = makeSubject("c1", 'Northwind "NW" Freight', "company");
    expect(buildQueries(quoted, 1)[0]?.text).toBe('"Northwind NW Freight" latest news');
  });

  it("keeps every query within 400 characters", () => {
    const long = makeSubject("p1", "A".repeat(120), "person", { company: "B".repeat(120), context: "C".repeat(200) });
    expect(buildQueries(long, 4).every((query) => query.text.length <= 400)).toBe(true);
  });

  it("keeps the news and leadership angles first when the budget is cut", () => {
    expect(buildQueries(company, 2).map((query) => query.text)).toEqual([
      '"Northwind Freight" latest news',
      '"Northwind Freight" leadership changes executive appointments',
    ]);
    expect(buildQueries(person, 2).map((query) => query.text)).toEqual([
      '"Amara Diallo" latest news',
      '"Amara Diallo" new role appointment',
    ]);
  });
});

describe("searchBudget", () => {
  it.each([
    [1, "company", 5],
    [1, "person", 4],
    [2, "company", 3],
    [2, "person", 3],
    [3, "company", 3],
    [4, "person", 2],
    [5, "company", 2],
  ] as const)("gives %i subject(s) of type %s a budget of %i each", (count, type, expected) => {
    expect(searchBudget(count, type)).toBe(expected);
  });
});

describe("planSearches", () => {
  it("plans each subject's queries within the shared budget, in subject order", () => {
    const planned = planSearches([company, person]);
    expect(planned.map((search) => search.subjectId)).toEqual(["c1", "c1", "c1", "p1", "p1", "p1"]);
    expect(planned[3]?.query.text).toBe('"Amara Diallo" latest news');
  });
});

describe("searchedTopics", () => {
  it("names what each subject's searches covered, within its budget", () => {
    expect(searchedTopics("company", 1)).toEqual(["news", "leadership changes", "funding and deals", "product launches", "risks"]);
    expect(searchedTopics("person", 2)).toEqual(["news", "new roles", "announcements"]);
  });
});
