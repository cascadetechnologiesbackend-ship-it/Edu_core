import type { ConsentPurposeId } from "@schoolmitra/validators";

// ─── Consent Purposes (DPDP Act 2023 compliant) ───────────────────────────────
// Each purpose independently toggleable — NO bundling, NO pre-ticked boxes
// Plain language descriptions in English + Hindi (DPDP Rules 2025 requirement)

export interface ConsentPurpose {
  readonly id: ConsentPurposeId;
  readonly label: string;
  readonly labelHindi: string;
  readonly description: string;
  readonly descriptionHindi: string;
  readonly mandatory: boolean;
  readonly legalBasis: string;
  readonly dataCategories: readonly string[];
  readonly retentionDays: number | "LEGAL_HOLD";
}

export const CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  {
    id: "admission_data",
    label: "Admission & Enrolment Data",
    labelHindi: "प्रवेश और नामांकन डेटा",
    description:
      "We collect your child's name, date of birth, and previous school details to process admission and generate an official admission number.",
    descriptionHindi:
      "प्रवेश संसाधित करने और आधिकारिक प्रवेश संख्या उत्पन्न करने के लिए हम आपके बच्चे का नाम, जन्म तिथि और पिछले स्कूल का विवरण एकत्र करते हैं।",
    mandatory: true,
    legalBasis: "DPDP Act 2023 Section 6 — Processing for legitimate purpose (admission)",
    dataCategories: ["name", "date_of_birth", "address", "previous_school"],
    retentionDays: 3650, // 10 years after Class 10 completion
  },
  {
    id: "academic_records",
    label: "Academic Records & Report Cards",
    labelHindi: "शैक्षणिक अभिलेख और रिपोर्ट कार्ड",
    description:
      "We record your child's marks, grades, and teacher remarks to generate report cards and track academic progress as required by the school board.",
    descriptionHindi:
      "रिपोर्ट कार्ड बनाने और स्कूल बोर्ड के अनुसार शैक्षणिक प्रगति को ट्रैक करने के लिए हम आपके बच्चे के अंक, ग्रेड और शिक्षक टिप्पणियाँ दर्ज करते हैं।",
    mandatory: true,
    legalBasis: "DPDP Act 2023 Section 6 — Processing for legitimate purpose (education records)",
    dataCategories: ["marks", "grades", "attendance_summary", "teacher_remarks"],
    retentionDays: 3650,
  },
  {
    id: "attendance",
    label: "Daily Attendance Tracking",
    labelHindi: "दैनिक उपस्थिति ट्रैकिंग",
    description:
      "We record whether your child is present, absent, or late each school day to maintain official attendance records as required by law.",
    descriptionHindi:
      "कानूनी आवश्यकता के अनुसार आधिकारिक उपस्थिति अभिलेख बनाए रखने के लिए हम प्रतिदिन दर्ज करते हैं कि आपका बच्चा उपस्थित, अनुपस्थित या विलंबित है।",
    mandatory: true,
    legalBasis: "RTE Act 2009 + DPDP Act 2023 Section 6",
    dataCategories: ["attendance_status", "date", "period"],
    retentionDays: 1825, // 5 years
  },
  {
    id: "health_records",
    label: "Health & Medical Records",
    labelHindi: "स्वास्थ्य और चिकित्सा अभिलेख",
    description:
      "We store allergy information, disability details, and emergency medical contacts to keep your child safe on school premises.",
    descriptionHindi:
      "स्कूल परिसर में आपके बच्चे की सुरक्षा के लिए हम एलर्जी जानकारी, विकलांगता विवरण और आपातकालीन चिकित्सा संपर्क संग्रहीत करते हैं।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 7(a) — Consent for sensitive personal data",
    dataCategories: ["allergies", "disabilities", "emergency_contacts", "medications"],
    retentionDays: 1095, // 3 years after leaving
  },
  {
    id: "photos_videos",
    label: "Photographs & Videos (School Events)",
    labelHindi: "फ़ोटो और वीडियो (स्कूल कार्यक्रम)",
    description:
      "We may take photographs or videos of your child during school events, sports days, or cultural programs for school records and communication.",
    descriptionHindi:
      "स्कूल अभिलेख और संचार के लिए हम स्कूल कार्यक्रमों, खेल दिवस या सांस्कृतिक कार्यक्रमों के दौरान आपके बच्चे की तस्वीरें या वीडियो ले सकते हैं।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 9 — Children's data requires explicit consent",
    dataCategories: ["photographs", "videos"],
    retentionDays: 1095,
  },
  {
    id: "transport",
    label: "Transport & GPS Location Data",
    labelHindi: "परिवहन और जीपीएस स्थान डेटा",
    description:
      "If your child uses school transport, we record their bus route and stop assignment. GPS tracking data is used only for real-time safety monitoring.",
    descriptionHindi:
      "यदि आपका बच्चा स्कूल परिवहन का उपयोग करता है, तो हम उनके बस मार्ग और स्टॉप असाइनमेंट को दर्ज करते हैं। जीपीएस ट्रैकिंग डेटा केवल वास्तविक समय सुरक्षा निगरानी के लिए उपयोग किया जाता है।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 7(a) — Consent for location data processing",
    dataCategories: ["route_assignment", "gps_coordinates", "timestamps"],
    retentionDays: 365,
  },
  {
    id: "communication",
    label: "SMS & Email Communication",
    labelHindi: "एसएमएस और ईमेल संचार",
    description:
      "We send SMS and email notifications about attendance, fee reminders, exam schedules, and school notices to your registered mobile and email.",
    descriptionHindi:
      "हम आपके पंजीकृत मोबाइल और ईमेल पर उपस्थिति, फीस अनुस्मारक, परीक्षा कार्यक्रम और स्कूल नोटिस के बारे में एसएमएस और ईमेल सूचनाएं भेजते हैं।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 6 — Consent for communication",
    dataCategories: ["mobile_number", "email_address"],
    retentionDays: 365,
  },
  {
    id: "biometric",
    label: "Biometric Attendance Data",
    labelHindi: "बायोमेट्रिक उपस्थिति डेटा",
    description:
      "If your school uses a biometric device, your child's fingerprint template will be stored only on the device and used solely for attendance marking.",
    descriptionHindi:
      "यदि आपका स्कूल बायोमेट्रिक डिवाइस का उपयोग करता है, तो आपके बच्चे का फिंगरप्रिंट टेम्पलेट केवल डिवाइस पर संग्रहीत किया जाएगा और केवल उपस्थिति अंकन के लिए उपयोग किया जाएगा।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 7(a) — Explicit consent for biometric data",
    dataCategories: ["fingerprint_template"],
    retentionDays: 365,
  },
  {
    id: "third_party_apps",
    label: "Third-Party EdTech Application Data",
    labelHindi: "तृतीय-पक्ष एडटेक एप्लिकेशन डेटा",
    description:
      "Some educational features may require sharing limited data with approved third-party applications. No data is shared without your explicit consent.",
    descriptionHindi:
      "कुछ शैक्षिक सुविधाओं के लिए अनुमोदित तृतीय-पक्ष एप्लिकेशन के साथ सीमित डेटा साझा करने की आवश्यकता हो सकती है। आपकी स्पष्ट सहमति के बिना कोई डेटा साझा नहीं किया जाता।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 6 + 8(7) — Disclosure to Data Processors",
    dataCategories: ["name", "grade", "performance_summary"],
    retentionDays: 365,
  },
  {
    id: "cctv",
    label: "CCTV Footage (Premises Security)",
    labelHindi: "सीसीटीवी फुटेज (परिसर सुरक्षा)",
    description:
      "School premises are monitored by CCTV cameras for safety and security. Footage is stored for 30 days and then automatically deleted.",
    descriptionHindi:
      "सुरक्षा के लिए स्कूल परिसर की निगरानी सीसीटीवी कैमरों से की जाती है। फुटेज 30 दिनों के लिए संग्रहीत की जाती है और फिर स्वचालित रूप से हटा दी जाती है।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 6 — Legitimate purpose (security)",
    dataCategories: ["video_footage"],
    retentionDays: 30,
  },
  {
    id: "published_results",
    label: "Publishing Academic Results",
    labelHindi: "शैक्षणिक परिणाम प्रकाशित करना",
    description:
      "This allows the school to publish your child's name and achievement in merit lists, toppers lists, or school notice boards for recognition.",
    descriptionHindi:
      "यह स्कूल को मेरिट सूचियों, टॉपर सूचियों या स्कूल नोटिस बोर्ड में आपके बच्चे का नाम और उपलब्धि प्रकाशित करने की अनुमति देता है।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 6 — Consent for public disclosure",
    dataCategories: ["name", "grade", "rank", "marks"],
    retentionDays: 365,
  },
  {
    id: "alumni_data",
    label: "Post-Graduation Alumni Records",
    labelHindi: "स्नातकोत्तर पूर्व छात्र अभिलेख",
    description:
      "After your child completes Class 10, we may retain their contact details for alumni records and school anniversary communications.",
    descriptionHindi:
      "आपके बच्चे के कक्षा 10 पूर्ण करने के बाद, हम पूर्व छात्र अभिलेखों और स्कूल वर्षगांठ संचार के लिए उनके संपर्क विवरण रख सकते हैं।",
    mandatory: false,
    legalBasis: "DPDP Act 2023 Section 6 — Consent for alumni processing",
    dataCategories: ["name", "contact_details", "graduation_year"],
    retentionDays: 1095,
  },
] as const satisfies readonly ConsentPurpose[];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export const MANDATORY_PURPOSE_IDS = CONSENT_PURPOSES.filter(
  (p) => p.mandatory
).map((p) => p.id) as ReadonlyArray<ConsentPurposeId>;

export function getConsentPurpose(id: ConsentPurposeId): ConsentPurpose {
  const purpose = CONSENT_PURPOSES.find((p) => p.id === id);
  if (!purpose) {
    throw new Error(`Unknown consent purpose: ${id}`);
  }
  return purpose;
}

export function getMandatoryPurposes(): readonly ConsentPurpose[] {
  return CONSENT_PURPOSES.filter((p) => p.mandatory);
}

export function getOptionalPurposes(): readonly ConsentPurpose[] {
  return CONSENT_PURPOSES.filter((p) => !p.mandatory);
}
