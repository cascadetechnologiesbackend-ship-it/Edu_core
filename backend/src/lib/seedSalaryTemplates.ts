export interface PreSeededTemplate {
  name: string;
  basicPercent: number;
  daPercent: number;
  hraPercent: number;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  esiApplicable: boolean;
  professionalTaxState: string;
}

export const DEFAULT_SALARY_TEMPLATES: PreSeededTemplate[] = [
  {
    name: "Standard Teaching Faculty",
    basicPercent: 50.0,
    daPercent: 10.0,
    hraPercent: 20.0,
    pfEmployeePercent: 12.0,
    pfEmployerPercent: 12.0,
    esiApplicable: false, // Auto-rule applies if Gross <= 21k
    professionalTaxState: "DL",
  },
  {
    name: "Admin Cadre",
    basicPercent: 45.0,
    daPercent: 10.0,
    hraPercent: 25.0,
    pfEmployeePercent: 12.0,
    pfEmployerPercent: 12.0,
    esiApplicable: false,
    professionalTaxState: "DL",
  },
  {
    name: "Support Staff",
    basicPercent: 60.0,
    daPercent: 15.0,
    hraPercent: 15.0,
    pfEmployeePercent: 12.0,
    pfEmployerPercent: 12.0,
    esiApplicable: true, // Support staff ESI enabled by default
    professionalTaxState: "DL",
  },
  {
    name: "Fixed Contract Staff",
    basicPercent: 100.0,
    daPercent: 0.0,
    hraPercent: 0.0,
    pfEmployeePercent: 0.0,
    pfEmployerPercent: 0.0,
    esiApplicable: false,
    professionalTaxState: "DL",
  },
];
