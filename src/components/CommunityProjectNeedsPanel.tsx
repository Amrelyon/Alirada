import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Compass,
  Filter,
  Globe,
  HelpCircle,
  Plus,
  Search,
  TrendingUp,
} from 'lucide-react';
import { Project, ProjectTypeStandard } from '../types/alirada';
import {
  CommunityScopeLevel,
  DEFAULT_PROJECT_STANDARDS,
  computeCommunityProjectNeeds,
} from '../data/projectStandards';

interface CommunityProjectNeedsPanelProps {
  standards: ProjectTypeStandard[];
  projects: Project[];
  onCreateNeededProject: (preset: {
    category: string;
    project_type: string;
    district?: string;
    city?: string;
    country?: string;
  }) => void;
}

export const CommunityProjectNeedsPanel: React.FC<CommunityProjectNeedsPanelProps> = ({
  standards,
  projects,
  onCreateNeededProject,
}) => {
  const activeStandards = standards.length > 0 ? standards : DEFAULT_PROJECT_STANDARDS;

  const [scope, setScope] = useState<CommunityScopeLevel>('global');
  const [countryFilter, setCountryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyNeeded, setOnlyNeeded] = useState(false);
  const [sortBy, setSortBy] = useState<'demand' | 'employment' | 'category'>('employment');

  const analysis = useMemo(
    () =>
      computeCommunityProjectNeeds(activeStandards, projects, {
        scope,
        country: countryFilter || undefined,
        city: cityFilter || undefined,
        district: districtFilter || undefined,
      }),
    [activeStandards, projects, scope, countryFilter, cityFilter, districtFilter]
  );

  const level1Categories = useMemo(
    () => Array.from(new Set(activeStandards.map((s) => s.category))),
    [activeStandards]
  );

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = analysis.rows.filter((row) => {
      if (categoryFilter !== 'ALL' && row.category !== categoryFilter) return false;
      if (onlyNeeded && row.remaining_demand <= 0) return false;
      if (
        q &&
        !row.project_type.toLowerCase().includes(q) &&
        !row.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'demand') {
        return (
          b.remaining_demand - a.remaining_demand ||
          b.employees_needed - a.employees_needed ||
          a.category.localeCompare(b.category)
        );
      }
      if (sortBy === 'employment') {
        return (
          b.employees_needed - a.employees_needed ||
          b.remaining_demand - a.remaining_demand ||
          a.category.localeCompare(b.category)
        );
      }
      return a.category.localeCompare(b.category) || a.project_type.localeCompare(b.project_type);
    });
  }, [analysis.rows, categoryFilter, onlyNeeded, searchQuery, sortBy]);

  const handleScopeChange = (nextScope: CommunityScopeLevel) => {
    setScope(nextScope);
    if (nextScope === 'global') {
      setCountryFilter('');
      setCityFilter('');
      setDistrictFilter('');
    } else if (nextScope === 'country') {
      setCityFilter('');
      setDistrictFilter('');
      if (!countryFilter && analysis.countries.length > 0) {
        setCountryFilter(analysis.countries[0]);
      }
    } else if (nextScope === 'city') {
      setDistrictFilter('');
      if (!cityFilter && analysis.cities.length > 0) {
        setCityFilter(analysis.cities[0]);
      }
    } else if (nextScope === 'district') {
      if (!districtFilter && analysis.districts.length > 0) {
        setDistrictFilter(analysis.districts[0]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Simple Logic Explainer & Scope Filter Header */}
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <h2 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#B88B1E] dark:text-[#D4AF37]" />
              Automatic Community Needs &amp; Employment Priority
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              Members simply create projects under a Category, Project Type, and District / City / Country. Alirada automatically counts existing projects against district standards to calculate what projects your community still needs and which projects require the most employees first.
            </p>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 rounded-lg self-start shrink-0">
            {(
              [
                ['global', 'Global'],
                ['country', 'Country'],
                ['city', 'City'],
                ['district', 'District'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleScopeChange(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scope === key
                    ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Simple 3-Step Math Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#B88B1E] dark:text-[#D4AF37]" />
              1. Required Standard
            </p>
            <p className="text-stone-600 dark:text-stone-400 font-mono-tabular">
              Required = Min Per District × {analysis.district_count}{' '}
              {analysis.district_count === 1 ? 'District' : 'Districts'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#B88B1E] dark:text-[#D4AF37]" />
              2. Remaining Demand
            </p>
            <p className="text-stone-600 dark:text-stone-400 font-mono-tabular">
              Demand = max(0, Required − Available Created Projects)
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              3. Employment Priority
            </p>
            <p className="text-stone-600 dark:text-stone-400 font-mono-tabular">
              Jobs Needed = Remaining Demand × Employees Per Project
            </p>
          </div>
        </div>

        {/* Location & Category Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {scope !== 'global' && (
            <div>
              <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1">
                Country Filter
              </label>
              <input
                type="text"
                list="community-country-options"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                placeholder="Any or select country..."
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <datalist id="community-country-options">
                {analysis.countries.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}

          {(scope === 'city' || scope === 'district') && (
            <div>
              <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1">
                City Filter
              </label>
              <input
                type="text"
                list="community-city-options"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Any or select city..."
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <datalist id="community-city-options">
                {analysis.cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}

          {scope === 'district' && (
            <div>
              <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1">
                District Filter
              </label>
              <input
                type="text"
                list="community-district-options"
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                placeholder="Any or select district..."
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <datalist id="community-district-options">
                {analysis.districts.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          )}

          <div>
            <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1">
              Level-1 Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            >
              <option value="ALL">All {level1Categories.length} Categories</option>
              {level1Categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-stone-600 dark:text-stone-400 mb-1">
              Priority Sort Order
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'demand' | 'employment' | 'category')}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
            >
              <option value="employment">Highest Employment Priority</option>
              <option value="demand">Most Projects in Demand</option>
              <option value="category">Category (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Summary KPI Strip & Top Recommended Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800">
            <p className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" /> Filtered Scope
            </p>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mt-1 truncate">
              {analysis.scope_label}
            </p>
            <p className="text-[11px] font-mono-tabular text-stone-500 mt-0.5">
              {analysis.district_count} {analysis.district_count === 1 ? 'district' : 'districts'} ·{' '}
              {analysis.matched_projects_count} existing
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Total Projects Needed
            </p>
            <p className="text-xl font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37] mt-0.5">
              {analysis.total_remaining_demand.toLocaleString()}
            </p>
            <p className="text-[11px] font-mono-tabular text-stone-500">
              {analysis.total_available_projects} built of {analysis.total_required_projects} req.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Most Project in Demand
            </p>
            {analysis.most_in_demand ? (
              <>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mt-1 truncate">
                  {analysis.most_in_demand.project_type}
                </p>
                <p className="text-[11px] font-mono-tabular text-amber-700 dark:text-amber-400">
                  {analysis.most_in_demand.remaining_demand} needed ·{' '}
                  {analysis.most_in_demand.category}
                </p>
              </>
            ) : (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                All district minimums fulfilled
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800">
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Highest Employment Priority
            </p>
            {analysis.highest_employment_priority ? (
              <>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mt-1 truncate">
                  {analysis.highest_employment_priority.project_type}
                </p>
                <p className="text-[11px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                  {analysis.highest_employment_priority.employees_needed.toLocaleString()} jobs needed ·{' '}
                  {analysis.highest_employment_priority.remaining_demand} proj.
                </p>
              </>
            ) : (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                Zero unmet employment demand
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Master Demand & Employment Table */}
      <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
              Master Community Project Needs Catalog ({visibleRows.length} types)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Total Workforce Needed to Operate Unbuilt Demand:{' '}
              <span className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                {analysis.total_employees_needed.toLocaleString()} employees
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search project type..."
                className="ps-8 pe-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
            </div>

            <button
              type="button"
              onClick={() => setOnlyNeeded((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5 font-medium transition-colors ${
                onlyNeeded
                  ? 'border-[#B88B1E] dark:border-[#D4AF37] bg-[#B88B1E]/10 text-[#B88B1E] dark:text-[#D4AF37]'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              {onlyNeeded ? 'Showing Needed Only' : 'Show All Types'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
              <tr>
                <th className="py-2.5 pe-3 text-start font-medium">Category</th>
                <th className="py-2.5 px-3 text-start font-medium">Project Type</th>
                <th className="py-2.5 px-3 text-end font-medium">Min / Dist</th>
                <th className="py-2.5 px-3 text-end font-medium">Required</th>
                <th className="py-2.5 px-3 text-end font-medium">Available</th>
                <th className="py-2.5 px-3 text-end font-medium">Demand #</th>
                <th className="py-2.5 px-3 text-end font-medium">Emp / Proj</th>
                <th className="py-2.5 px-3 text-end font-medium">Employees Needed</th>
                <th className="py-2.5 px-3 text-start font-medium">Status</th>
                <th className="py-2.5 ps-3 text-end font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-stone-500">
                    No project types match the current filter.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const isTopEmployment =
                    analysis.highest_employment_priority?.id === row.id && row.employees_needed > 0;
                  const isTopDemand =
                    analysis.most_in_demand?.id === row.id && row.remaining_demand > 0;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-[#0B0D10]/70 transition-colors"
                    >
                      <td className="py-2.5 pe-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {row.project_type}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono-tabular">
                        {row.min_per_district}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono-tabular">
                        {row.required_count}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono-tabular text-stone-700 dark:text-stone-300">
                        {row.available_count}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                        {row.remaining_demand}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono-tabular">
                        {row.employees_per_project.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                        {row.employees_needed.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {row.recommended ? (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            {isTopEmployment
                              ? 'Priority · Top Jobs'
                              : isTopDemand
                                ? 'Priority · Top Demand'
                                : 'Recommended'}
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            District Met
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 ps-3 text-end whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onCreateNeededProject({
                              category: row.category,
                              project_type: row.project_type,
                              district: districtFilter || undefined,
                              city: cityFilter || undefined,
                              country: countryFilter || undefined,
                            })
                          }
                          className="px-2.5 py-1 rounded-md border border-stone-300 dark:border-stone-700 hover:border-[#B88B1E] dark:hover:border-[#D4AF37] text-stone-800 dark:text-stone-200 font-medium inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Launch
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
