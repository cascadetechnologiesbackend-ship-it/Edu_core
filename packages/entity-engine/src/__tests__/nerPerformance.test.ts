import { describe, it, expect } from "vitest";
import { parseOmniboxQuery } from "../query-ner/parser";

describe("Phase E7: Sub-5ms Performance CI Enforcement (AC-E13 & BR10)", () => {
  // Generate 200 diverse bilingual queries (length 4-40 chars)
  const baseCorpus: string[] = [
    // English academic & exam queries
    "enter marks 10-A maths",
    "enter marks class 10-A mathematics",
    "class 12-b physics marks",
    "grade 9 science marks entry",
    "term 1 marks 10-A",
    "half yearly exam marks class 8",
    "annual exam schedule datesheet",
    "ut2 exam timetable",
    "pre board schedule class 10",
    "generate report card class 5-b",
    "report card 10-A",
    "student 360 profile",
    "find student aarav sharma",
    // English attendance & timetable queries
    "take attendance grade 8",
    "10-A attendance",
    "class 7-c roll call",
    "my day schedule",
    "view myday timeline",
    "class timetable grade 6",
    "view substitutions",
    "substitute teacher today",
    "apply for leave",
    "teacher leave request",
    // English fees & transport queries
    "tuition fee dues",
    "pending fee dues",
    "transport fee payment",
    "annual fee balance",
    "collect fee class 10",
    "where is bus route 4",
    "track bus route 12",
    "bus live location",
    "route 4 bus stop",
    "school bus tracking",
    // English communications & HR
    "school notices",
    "create broadcast notice",
    "book ptm slot",
    "parent teacher meeting",
    "staff directory",
    "monthly salary payroll",
    "teacher payroll payslip",
    // Hindi academic & exam queries
    "कक्षा 10-ए गणित के अंक",
    "कक्षा 12 भौतिकी अंक",
    "अंक दर्ज करें कक्षा 10",
    "प्रथम सत्र अंक 10-ए",
    "अर्धवार्षिक परीक्षा टाइम टेबल",
    "वार्षिक परीक्षा समय सारणी",
    "प्रगति पत्र कक्षा 5-बी",
    "विद्यार्थी प्रोफाइल",
    "छात्र 360 खोजें",
    // Hindi attendance & timetable queries
    "उपस्थिति कक्षा 8",
    "हाजिरी 10-ए",
    "कक्षा 9 उपस्थिति दर्ज करें",
    "माई डे समय सारणी",
    "समय सारणी कक्षा 7",
    "प्रतिस्थापन कार्यक्षेत्र",
    "छुट्टी का आवेदन",
    "अवकाश प्रार्थना पत्र",
    // Hindi fees & transport queries
    "स्कूल फीस",
    "ट्यूशन फीस बकाया",
    "परिवहन शुल्क जमा",
    "वार्षिक शुल्क बकाया",
    "बस कहां है",
    "बस रूट 4",
    "गाड़ी लोकेशन रूट 12",
    "लाइव बस ट्रैकिंग",
    // Hindi communications & HR
    "स्कूल की सूचनाएं",
    "नोटिस बनाएं",
    "पीटीएम स्लॉट बुक करें",
    "शिक्षक बैठक",
    "शिक्षक सूची",
    "वेतन पर्ची और पेरोल",
    // Devanagari numerals
    "कक्षा १०-ए गणित",
    "कक्षा १२-बी भौतिकी",
    "बस रूट ४",
    "बस रूट १२",
    "उपस्थिति कक्षा ८",
    "फीस कक्षा ५",
  ];

  // Expand base corpus to 200 distinct realistic queries
  const fullCorpus: string[] = [];
  const sections = ["A", "B", "C", "D"];
  const grades = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  // Populate until at least 200 queries
  for (const q of baseCorpus) {
    fullCorpus.push(q);
  }

  let gIdx = 0;
  while (fullCorpus.length < 200) {
    const g = grades[gIdx % grades.length];
    const s = sections[gIdx % sections.length];
    fullCorpus.push(`take attendance class ${g}-${s}`);
    fullCorpus.push(`enter marks class ${g}-${s} maths`);
    fullCorpus.push(`fee dues class ${g}-${s}`);
    fullCorpus.push(`कक्षा ${g}-${s} उपस्थिति`);
    gIdx++;
  }

  it(`asserts p95 parseDurationMs < 5ms over ${fullCorpus.length} bilingual queries`, () => {
    // Warmup JIT
    for (let i = 0; i < 20; i++) {
      parseOmniboxQuery(fullCorpus[i % fullCorpus.length]!);
    }

    const durations: number[] = [];

    for (const query of fullCorpus) {
      const res = parseOmniboxQuery(query);
      durations.push(res.parseDurationMs);
    }

    durations.sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[p95Index]!;
    const p50 = durations[Math.floor(durations.length * 0.5)]!;
    const max = durations[durations.length - 1]!;

    console.log(
      `[NER Performance] Sample: ${fullCorpus.length} queries | p50: ${p50}ms | p95: ${p95}ms | max: ${max}ms`
    );

    expect(p95).toBeLessThan(5.0);
  });
});
