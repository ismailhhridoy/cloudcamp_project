// Matches doctor-recommended tests (free-text) against our seeded free-test-locations DB.
// Returns a list of providers offering the matched tests free or low-cost, district-filtered.

export interface FreeTestProvider {
  id: string;
  name_en: string;
  name_bn: string;
  type: "government" | "ngo" | "campaign";
  districts: string[];
  freeTests: string[];
  hours_en: string;
  hours_bn: string;
  phone?: string;
  note_en: string;
  note_bn: string;
}

export interface FreeTestDoc {
  updatedAt: string;
  source: string;
  tests: Record<string, string[]>;
  providers: FreeTestProvider[];
}

let cached: FreeTestDoc | null = null;

export async function loadFreeTestsDb(): Promise<FreeTestDoc> {
  if (cached) return cached;
  const res = await fetch("/free-test-locations.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("free-test db unreachable");
  cached = await res.json();
  return cached!;
}

// Map a free-text test name (e.g. "CBC", "FBS", "Blood sugar") to one of our test keys.
export function classifyTest(testText: string, db: FreeTestDoc): string | null {
  const lower = testText.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(db.tests)) {
    if (aliases.some((a) => lower.includes(a))) return key;
  }
  return null;
}

export interface MatchedTest {
  test: string;          // original test name
  key: string;           // mapped key
  providers: FreeTestProvider[];
}

export async function matchTests(testNames: string[], district?: string): Promise<MatchedTest[]> {
  if (!testNames || testNames.length === 0) return [];
  const db = await loadFreeTestsDb();
  const out: MatchedTest[] = [];
  for (const test of testNames) {
    const key = classifyTest(test, db);
    if (!key) continue;
    const providers = db.providers.filter((p) => {
      if (!p.freeTests.includes(key)) return false;
      if (p.districts.includes("all")) return true;
      if (!district) return true;
      return p.districts.includes(district);
    });
    if (providers.length > 0) out.push({ test, key, providers });
  }
  return out;
}
