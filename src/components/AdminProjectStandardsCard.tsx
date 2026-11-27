import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import { ProjectTypeStandard } from '../types/alirada';
import { DEFAULT_PROJECT_STANDARDS } from '../data/projectStandards';
import { useAlirada } from '../context/AliradaContext';

export const AdminProjectStandardsCard: React.FC = () => {
  const { systemConfig, updateSystemConfig, pushToast } = useAlirada();

  const savedStandards = useMemo(
    () =>
      systemConfig.project_standards && systemConfig.project_standards.length > 0
        ? systemConfig.project_standards
        : DEFAULT_PROJECT_STANDARDS,
    [systemConfig.project_standards]
  );

  const [draftRows, setDraftRows] = useState<ProjectTypeStandard[]>(savedStandards);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  // Add new standard row form
  const [newCat, setNewCat] = useState('Food');
  const [newType, setNewType] = useState('');
  const [newMin, setNewMin] = useState(1);
  const [newEmp, setNewEmp] = useState(25);

  useEffect(() => {
    setDraftRows(savedStandards);
  }, [savedStandards]);

  const categories = useMemo(
    () => Array.from(new Set(draftRows.map((r) => r.category))),
    [draftRows]
  );

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return draftRows.filter((r) => {
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (
        q &&
        !r.project_type.toLowerCase().includes(q) &&
        !r.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [draftRows, categoryFilter, searchQuery]);

  const handleFieldChange = (
    id: string,
    field: keyof ProjectTypeStandard,
    value: string | number
  ) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = newCat.trim();
    const pType = newType.trim();
    if (!cat || !pType) return;
    if (draftRows.some((r) => r.project_type.toLowerCase() === pType.toLowerCase())) {
      pushToast('warning', `Project type "${pType}" already exists in the table.`);
      return;
    }
    const newRow: ProjectTypeStandard = {
      id: `std_custom_${Date.now().toString(36)}`,
      category: cat,
      project_type: pType,
      min_per_district: Math.max(0, Number(newMin) || 0),
      employees_per_project: Math.max(0, Number(newEmp) || 0),
    };
    setDraftRows((prev) => [newRow, ...prev]);
    setNewType('');
    pushToast('success', `Added "${pType}" to draft. Click Save Master Standards to persist.`);
  };

  const handleSaveStandards = async () => {
    const cleaned = draftRows.filter((r) => r.category.trim() && r.project_type.trim());
    if (cleaned.length === 0) {
      pushToast('error', 'Master standards list cannot be empty.');
      return;
    }
    await updateSystemConfig({ project_standards: cleaned });
  };

  const handleResetDefaults = async () => {
    setDraftRows(DEFAULT_PROJECT_STANDARDS);
    setConfirmReset(false);
    await updateSystemConfig({ project_standards: DEFAULT_PROJECT_STANDARDS });
  };

  return (
    <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-5 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <Building2 className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
            Community Project Standards Master Table ({draftRows.length} types across{' '}
            {categories.length} categories)
          </h2>
          <p className="text-stone-500 dark:text-stone-400">
            Admin-editable recommended Minimum Projects Per District and Average Employees Per Project. Automatically powers District, City, Country, and Global demand calculations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 inline-flex items-center gap-1.5 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold"
              >
                Confirm Reset ({DEFAULT_PROJECT_STANDARDS.length})
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveStandards}
            className="px-4 py-1.5 rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 font-semibold inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save Master Standards
          </button>
        </div>
      </div>

      {/* Add New Project Standard Row */}
      <form
        onSubmit={handleAddRow}
        className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3.5 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800"
      >
        <input
          type="text"
          required
          list="admin-standard-cats"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Level-1 Category"
          className="sm:col-span-3 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
        />
        <datalist id="admin-standard-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <input
          type="text"
          required
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          placeholder="New Level-2 Project Type..."
          className="sm:col-span-4 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
        />

        <div className="sm:col-span-2">
          <input
            type="number"
            min={0}
            required
            title="Min Per District"
            value={newMin}
            onChange={(e) => setNewMin(Number(e.target.value))}
            placeholder="Min/Dist"
            className="w-full px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
          />
        </div>

        <div className="sm:col-span-2">
          <input
            type="number"
            min={0}
            required
            title="Employees Per Project"
            value={newEmp}
            onChange={(e) => setNewEmp(Number(e.target.value))}
            placeholder="Employees"
            className="w-full px-2.5 py-1.5 font-mono-tabular rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#12151B]"
          />
        </div>

        <button
          type="submit"
          className="sm:col-span-1 px-3 py-1.5 rounded bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold inline-flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </form>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
        >
          <option value="ALL">All Categories ({draftRows.length})</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat} ({draftRows.filter((r) => r.category === cat).length})
            </option>
          ))}
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter master standards..."
            className="w-full ps-8 pe-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
          />
        </div>
      </div>

      {/* Inline Editable Table */}
      <div className="max-h-[420px] overflow-y-auto overflow-x-auto border border-stone-200 dark:border-stone-800 rounded-lg">
        <table className="w-full text-xs text-start">
          <thead className="sticky top-0 bg-stone-50 dark:bg-[#0B0D10] border-b border-stone-200 dark:border-stone-800 text-stone-500">
            <tr>
              <th className="py-2 px-3 text-start font-medium">Category</th>
              <th className="py-2 px-3 text-start font-medium">Project Type</th>
              <th className="py-2 px-3 text-end font-medium">Min Per District</th>
              <th className="py-2 px-3 text-end font-medium">Employees Per Project</th>
              <th className="py-2 px-3 text-end font-medium">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td className="py-1.5 px-3">
                  <input
                    type="text"
                    value={row.category}
                    onChange={(e) => handleFieldChange(row.id, 'category', e.target.value)}
                    className="w-36 px-2 py-1 rounded border border-stone-200 dark:border-stone-800 bg-transparent"
                  />
                </td>
                <td className="py-1.5 px-3">
                  <input
                    type="text"
                    value={row.project_type}
                    onChange={(e) => handleFieldChange(row.id, 'project_type', e.target.value)}
                    className="w-52 px-2 py-1 rounded border border-stone-200 dark:border-stone-800 bg-transparent font-medium"
                  />
                </td>
                <td className="py-1.5 px-3 text-end">
                  <input
                    type="number"
                    min={0}
                    value={row.min_per_district}
                    onChange={(e) =>
                      handleFieldChange(
                        row.id,
                        'min_per_district',
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="w-20 px-2 py-1 text-end font-mono-tabular rounded border border-stone-200 dark:border-stone-800 bg-transparent"
                  />
                </td>
                <td className="py-1.5 px-3 text-end">
                  <input
                    type="number"
                    min={0}
                    value={row.employees_per_project}
                    onChange={(e) =>
                      handleFieldChange(
                        row.id,
                        'employees_per_project',
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    }
                    className="w-24 px-2 py-1 text-end font-mono-tabular rounded border border-stone-200 dark:border-stone-800 bg-transparent"
                  />
                </td>
                <td className="py-1.5 px-3 text-end">
                  <button
                    type="button"
                    onClick={() => setDraftRows((prev) => prev.filter((r) => r.id !== row.id))}
                    className="p-1 text-stone-400 hover:text-rose-600"
                    title="Remove project type"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
