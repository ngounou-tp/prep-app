// What fits on the one page: people grouped under their company, and at most 8 developments
// across the meeting, with every subject that has findings shown at least once.
import { normaliseName, type CompanyGroup, type Subject, type VerifiedClaim } from "@/lib/types";

const PAGE_LIMIT = 8;

export function groupSubjects(subjects: readonly Subject[]): CompanyGroup[] {
  const groups: CompanyGroup[] = [];
  const byCompany = new Map<string, CompanyGroup>();
  const groupFor = (companyName: string): CompanyGroup => {
    const key = normaliseName(companyName);
    const existing = byCompany.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const group: CompanyGroup = { companyName, companySubjectId: null, personSubjectIds: [] };
    byCompany.set(key, group);
    groups.push(group);
    return group;
  };
  for (const subject of subjects) {
    if (subject.type === "company") {
      const group = groupFor(subject.name);
      group.companyName = subject.name;
      group.companySubjectId = subject.id;
    } else if (subject.company === undefined) {
      groups.push({ companyName: null, companySubjectId: null, personSubjectIds: [subject.id] });
    } else {
      groupFor(subject.company).personSubjectIds.push(subject.id);
    }
  }
  return groups;
}

// A shared claim is listed under the person it names, as the more specific subject.
export function homeSubjectId(claim: VerifiedClaim, subjects: readonly Subject[]): string {
  const tagged = subjects.filter((subject) => claim.subjectIds.includes(subject.id));
  return (tagged.find((subject) => subject.type === "person") ?? tagged[0])?.id ?? claim.subjectIds[0];
}

// Claims arrive sorted by status then recency. Each subject with findings gets its best claim
// first, then the remaining slots go in that same order.
export function selectForPage(claims: readonly VerifiedClaim[], subjects: readonly Subject[]): Set<string> {
  const eligible = claims.filter((claim) => claim.status !== "unconfirmed");
  const chosen = new Set<string>();
  for (const subject of subjects) {
    const covered = eligible.some((claim) => chosen.has(claim.id) && claim.subjectIds.includes(subject.id));
    const best = eligible.find((claim) => claim.subjectIds.includes(subject.id));
    if (!covered && best !== undefined && chosen.size < PAGE_LIMIT) {
      chosen.add(best.id);
    }
  }
  for (const claim of eligible) {
    if (chosen.size >= PAGE_LIMIT) {
      break;
    }
    chosen.add(claim.id);
  }
  return chosen;
}
