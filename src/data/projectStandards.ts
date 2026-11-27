import { Project, ProjectTypeStandard } from '../types/alirada';

// Raw master catalog: [category, project_type, min_per_district, employees_per_project]
const RAW_PROJECT_STANDARDS: [string, string, number, number][] = [
  // Food (12)
  ['Food', 'Farm', 2, 200],
  ['Food', 'Greenhouse', 2, 30],
  ['Food', 'Fish Farm', 1, 50],
  ['Food', 'Poultry Farm', 1, 50],
  ['Food', 'Livestock Farm', 1, 50],
  ['Food', 'Dairy Farm', 1, 50],
  ['Food', 'Food Factory', 1, 300],
  ['Food', 'Food Storage Facility', 2, 20],
  ['Food', 'Food Distribution Center', 2, 50],
  ['Food', 'Grocery Store', 8, 20],
  ['Food', 'Supermarket', 2, 100],
  ['Food', 'Market', 2, 100],

  // Water (7)
  ['Water', 'Water Well', 2, 5],
  ['Water', 'Water Network', 1, 25],
  ['Water', 'Water Storage Facility', 2, 10],
  ['Water', 'Water Reservoir', 1, 20],
  ['Water', 'Water Treatment Plant', 1, 100],
  ['Water', 'Wastewater Treatment Plant', 1, 80],
  ['Water', 'Desalination Plant', 1, 200],

  // Energy (6)
  ['Energy', 'Solar Plant', 1, 100],
  ['Energy', 'Wind Farm', 1, 50],
  ['Energy', 'Battery Storage Facility', 1, 25],
  ['Energy', 'Power Plant', 1, 500],
  ['Energy', 'Energy Distribution Center', 1, 50],
  ['Energy', 'Charging Station Network', 2, 10],

  // Housing (7)
  ['Housing', 'Housing Project', 10, 100],
  ['Housing', 'Apartment Complex', 10, 20],
  ['Housing', 'Residential Community', 2, 30],
  ['Housing', 'Affordable Housing Project', 4, 50],
  ['Housing', 'Student Housing', 1, 20],
  ['Housing', 'Elder Housing', 1, 20],
  ['Housing', 'Emergency Shelter', 1, 20],

  // Healthcare (7)
  ['Healthcare', 'Hospital', 1, 500],
  ['Healthcare', 'Clinic', 2, 50],
  ['Healthcare', 'Medical Center', 1, 100],
  ['Healthcare', 'Emergency Medical Center', 1, 100],
  ['Healthcare', 'Mental Health Center', 1, 40],
  ['Healthcare', 'Rehabilitation Center', 1, 40],
  ['Healthcare', 'Pharmacy', 4, 10],

  // Education (7)
  ['Education', 'Kindergarten', 2, 20],
  ['Education', 'School', 4, 80],
  ['Education', 'University', 1, 500],
  ['Education', 'Library', 2, 15],
  ['Education', 'Training Center', 2, 30],
  ['Education', 'Vocational Center', 2, 30],
  ['Education', 'Research Institute', 1, 100],

  // Employment (7)
  ['Employment', 'Workforce Center', 1, 20],
  ['Employment', 'Recruitment Center', 1, 10],
  ['Employment', 'Freelance Hub', 1, 10],
  ['Employment', 'Career Center', 1, 10],
  ['Employment', 'Entrepreneurship Center', 1, 20],
  ['Employment', 'Startup Incubator', 1, 15],
  ['Employment', 'Startup Accelerator', 1, 20],

  // Transportation (8)
  ['Transportation', 'Road Project', 1, 200],
  ['Transportation', 'Bridge Project', 1, 100],
  ['Transportation', 'Bus Station', 2, 50],
  ['Transportation', 'Railway Station', 1, 100],
  ['Transportation', 'Airport', 1, 1000],
  ['Transportation', 'Port', 1, 1000],
  ['Transportation', 'Logistics Hub', 1, 500],
  ['Transportation', 'Warehouse', 3, 100],

  // Technology (8)
  ['Technology', 'Website Platform', 1, 10],
  ['Technology', 'Mobile Application', 1, 20],
  ['Technology', 'Software Platform', 1, 50],
  ['Technology', 'AI Platform', 1, 50],
  ['Technology', 'Database System', 1, 20],
  ['Technology', 'Data Center', 1, 100],
  ['Technology', 'Cybersecurity Platform', 1, 30],
  ['Technology', 'Technology Hub', 1, 200],

  // Business (8)
  ['Business', 'Marketplace', 2, 100],
  ['Business', 'Cooperative', 2, 50],
  ['Business', 'Business Center', 2, 50],
  ['Business', 'Commercial Center', 2, 100],
  ['Business', 'Investment Fund', 1, 20],
  ['Business', 'Bank', 1, 100],
  ['Business', 'Insurance Company', 1, 50],
  ['Business', 'Payment Platform', 1, 50],

  // Manufacturing (5)
  ['Manufacturing', 'Factory', 2, 1000],
  ['Manufacturing', 'Assembly Plant', 1, 300],
  ['Manufacturing', 'Processing Plant', 1, 300],
  ['Manufacturing', 'Industrial Park', 1, 5000],
  ['Manufacturing', 'Manufacturing Center', 1, 500],

  // Research (5)
  ['Research', 'Laboratory', 1, 50],
  ['Research', 'Research Center', 1, 100],
  ['Research', 'Innovation Center', 1, 100],
  ['Research', 'Technology Research Center', 1, 80],
  ['Research', 'Medical Research Center', 1, 100],

  // Community (6)
  ['Community', 'Community Center', 2, 20],
  ['Community', 'Youth Center', 1, 15],
  ['Community', 'Family Center', 1, 15],
  ['Community', 'Sports Center', 2, 30],
  ['Community', 'Cultural Center', 1, 20],
  ['Community', 'Social Support Center', 1, 20],

  // Environment (5)
  ['Environment', 'Recycling Center', 1, 50],
  ['Environment', 'Waste Management Facility', 1, 100],
  ['Environment', 'Reforestation Project', 1, 100],
  ['Environment', 'Conservation Project', 1, 50],
  ['Environment', 'Environmental Monitoring Center', 1, 20],

  // Governance (5)
  ['Governance', 'Public Service Center', 1, 50],
  ['Governance', 'Digital Government Platform', 1, 50],
  ['Governance', 'Civic Participation Platform', 1, 20],
  ['Governance', 'Public Consultation Platform', 1, 20],
  ['Governance', 'Administrative Center', 1, 50],

  // Culture (5)
  ['Culture', 'Museum', 1, 30],
  ['Culture', 'Heritage Center', 1, 20],
  ['Culture', 'Arts Center', 1, 20],
  ['Culture', 'Media Platform', 1, 50],
  ['Culture', 'News Platform', 1, 50],

  // Humanitarian (9)
  ['Humanitarian', 'Food Assistance Center', 1, 20],
  ['Humanitarian', 'Housing Assistance Center', 1, 20],
  ['Humanitarian', 'Community Assistance Center', 1, 20],
  ['Humanitarian', 'Child Support Center', 1, 20],
  ['Humanitarian', 'Elder Support Center', 1, 20],
  ['Humanitarian', 'Disability Support Center', 1, 20],
  ['Humanitarian', 'Refugee Support Center', 1, 50],
  ['Humanitarian', 'Emergency Response Center', 1, 100],
  ['Humanitarian', 'Disaster Recovery Center', 1, 100],

  // Security (3)
  ['Security', 'Security Center', 1, 100],
  ['Security', 'Fire Station', 1, 100],
  ['Security', 'Disaster Management Center', 1, 50],

  // Legal (3)
  ['Legal', 'Law Firm', 2, 20],
  ['Legal', 'Legal Aid Center', 1, 20],
  ['Legal', 'Court Facility', 1, 100],

  // Tourism (4)
  ['Tourism', 'Hotel', 2, 50],
  ['Tourism', 'Resort', 1, 100],
  ['Tourism', 'Travel Agency', 2, 10],
  ['Tourism', 'Tourist Center', 1, 20],

  // Religion (3)
  ['Religion', 'Mosque', 2, 20],
  ['Religion', 'Religious Education Center', 1, 15],
  ['Religion', 'Religious Community Center', 1, 15],

  // Sports (4)
  ['Sports', 'Stadium', 1, 200],
  ['Sports', 'Sports Club', 2, 20],
  ['Sports', 'Fitness Center', 2, 15],
  ['Sports', 'Sports Academy', 1, 30],

  // Utilities (4)
  ['Utilities', 'Electricity Distribution Center', 1, 50],
  ['Utilities', 'Gas Distribution Center', 1, 50],
  ['Utilities', 'Sewage Network', 1, 50],
  ['Utilities', 'Telecom Network Center', 1, 50],
];

export const DEFAULT_PROJECT_STANDARDS: ProjectTypeStandard[] = RAW_PROJECT_STANDARDS.map(
  ([category, project_type, min_per_district, employees_per_project], idx) => ({
    id: `std_${String(idx + 1).padStart(3, '0')}`,
    category,
    project_type,
    min_per_district,
    employees_per_project,
  })
);

export type CommunityScopeLevel = 'global' | 'country' | 'city' | 'district';

export interface CommunityScopeFilter {
  scope: CommunityScopeLevel;
  country?: string;
  city?: string;
  district?: string;
}

export interface ProjectNeedRow {
  id: string;
  category: string;
  project_type: string;
  min_per_district: number;
  employees_per_project: number;
  required_count: number;
  available_count: number;
  remaining_demand: number;
  employees_needed: number;
  coverage_pct: number;
  recommended: boolean;
}

export interface CommunityNeedsAnalysis {
  scope: CommunityScopeLevel;
  scope_label: string;
  district_count: number;
  matched_projects_count: number;
  total_required_projects: number;
  total_available_projects: number;
  total_remaining_demand: number;
  total_employees_needed: number;
  rows: ProjectNeedRow[];
  most_in_demand: ProjectNeedRow | null;
  highest_employment_priority: ProjectNeedRow | null;
  countries: string[];
  cities: string[];
  districts: string[];
}

function normLoc(value?: string): string {
  return (value || '').trim().toLowerCase();
}

export function extractProjectLocationFields(project: Project): {
  country: string;
  city: string;
  district: string;
} {
  let country = (project.country || '').trim();
  let city = (project.city || '').trim();
  let district = (project.district || '').trim();

  if (!country && !city && project.location) {
    const parts = project.location
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      district = district || parts[0];
      city = city || parts[1];
      country = country || parts[2];
    } else if (parts.length === 2) {
      city = city || parts[0];
      country = country || parts[1];
    } else if (parts.length === 1) {
      city = city || parts[0];
    }
  }

  return { country, city, district };
}

export function computeCommunityProjectNeeds(
  standards: ProjectTypeStandard[],
  projects: Project[],
  filter: CommunityScopeFilter
): CommunityNeedsAnalysis {
  const activeStandards = standards.length > 0 ? standards : DEFAULT_PROJECT_STANDARDS;

  const countriesSet = new Set<string>();
  const citiesSet = new Set<string>();
  const districtsSet = new Set<string>();

  const enrichedProjects = projects.map((p) => {
    const loc = extractProjectLocationFields(p);
    if (loc.country) countriesSet.add(loc.country);
    if (loc.city && (!filter.country || normLoc(loc.country) === normLoc(filter.country))) {
      citiesSet.add(loc.city);
    }
    if (
      loc.district &&
      (!filter.country || normLoc(loc.country) === normLoc(filter.country)) &&
      (!filter.city || normLoc(loc.city) === normLoc(filter.city))
    ) {
      districtsSet.add(loc.district);
    }
    return { project: p, ...loc };
  });

  const matchingProjects = enrichedProjects.filter((item) => {
    if (filter.scope === 'country' && filter.country) {
      return normLoc(item.country) === normLoc(filter.country);
    }
    if (filter.scope === 'city' && filter.city) {
      const cityOk = normLoc(item.city) === normLoc(filter.city);
      const countryOk = !filter.country || normLoc(item.country) === normLoc(filter.country);
      return cityOk && countryOk;
    }
    if (filter.scope === 'district' && filter.district) {
      const distOk = normLoc(item.district) === normLoc(filter.district);
      const cityOk = !filter.city || normLoc(item.city) === normLoc(filter.city);
      const countryOk = !filter.country || normLoc(item.country) === normLoc(filter.country);
      return distOk && cityOk && countryOk;
    }
    return true;
  });

  // Compute unique active districts inside the selected scope (always >= 1 so baseline district minimums always show)
  const scopedDistrictKeys = new Set<string>();
  matchingProjects.forEach((item) => {
    const dKey = [normLoc(item.country), normLoc(item.city), normLoc(item.district)]
      .filter(Boolean)
      .join('|');
    if (item.district) {
      scopedDistrictKeys.add(dKey || normLoc(item.district));
    } else if (item.city) {
      scopedDistrictKeys.add(`city:${normLoc(item.city)}`);
    }
  });

  const districtCount =
    filter.scope === 'district' ? 1 : Math.max(1, scopedDistrictKeys.size);

  // Count created projects per project_type (case-insensitive)
  const countByType = new Map<string, number>();
  for (const item of matchingProjects) {
    const pType = (item.project.project_type || '').trim().toLowerCase();
    if (pType) {
      countByType.set(pType, (countByType.get(pType) || 0) + 1);
    }
  }

  const rows: ProjectNeedRow[] = activeStandards.map((std) => {
    const minPerDist = Math.max(0, Number(std.min_per_district) || 0);
    const empPerProj = Math.max(0, Number(std.employees_per_project) || 0);
    const required_count = minPerDist * districtCount;
    const available_count = countByType.get(std.project_type.trim().toLowerCase()) || 0;
    const remaining_demand = Math.max(0, required_count - available_count);
    const employees_needed = remaining_demand * empPerProj;
    const coverage_pct =
      required_count > 0
        ? Math.min(100, Math.round((available_count / required_count) * 100))
        : 100;

    return {
      id: std.id,
      category: std.category,
      project_type: std.project_type,
      min_per_district: minPerDist,
      employees_per_project: empPerProj,
      required_count,
      available_count,
      remaining_demand,
      employees_needed,
      coverage_pct,
      recommended: remaining_demand > 0,
    };
  });

  const most_in_demand =
    rows
      .filter((r) => r.remaining_demand > 0)
      .sort(
        (a, b) =>
          b.remaining_demand - a.remaining_demand ||
          b.employees_needed - a.employees_needed ||
          b.min_per_district - a.min_per_district
      )[0] || null;

  const highest_employment_priority =
    rows
      .filter((r) => r.employees_needed > 0)
      .sort(
        (a, b) =>
          b.employees_needed - a.employees_needed ||
          b.remaining_demand - a.remaining_demand ||
          b.employees_per_project - a.employees_per_project
      )[0] || null;

  const total_required_projects = rows.reduce((s, r) => s + r.required_count, 0);
  const total_available_projects = rows.reduce((s, r) => s + r.available_count, 0);
  const total_remaining_demand = rows.reduce((s, r) => s + r.remaining_demand, 0);
  const total_employees_needed = rows.reduce((s, r) => s + r.employees_needed, 0);

  let scope_label = 'Global Community';
  if (filter.scope === 'country') {
    scope_label = filter.country ? `Country: ${filter.country}` : 'Country Scope';
  } else if (filter.scope === 'city') {
    scope_label = filter.city ? `City: ${filter.city}` : 'City Scope';
  } else if (filter.scope === 'district') {
    scope_label = filter.district ? `District: ${filter.district}` : 'District Scope';
  }

  return {
    scope: filter.scope,
    scope_label,
    district_count: districtCount,
    matched_projects_count: matchingProjects.length,
    total_required_projects,
    total_available_projects,
    total_remaining_demand,
    total_employees_needed,
    rows,
    most_in_demand,
    highest_employment_priority,
    countries: Array.from(countriesSet).sort((a, b) => a.localeCompare(b)),
    cities: Array.from(citiesSet).sort((a, b) => a.localeCompare(b)),
    districts: Array.from(districtsSet).sort((a, b) => a.localeCompare(b)),
  };
}
