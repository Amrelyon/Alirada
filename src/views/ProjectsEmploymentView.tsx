import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileSpreadsheet,
  FolderKanban,
  Link2,
  Plus,
  Send,
  Settings,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { ProjectHierarchyItem, ProjectInvestmentReportLink } from '../types/alirada';
import { UserAvatar } from '../components/UserAvatar';
import { InvestmentAnalyticsChart } from '../components/InvestmentAnalyticsChart';
import { CommunityProjectNeedsPanel } from '../components/CommunityProjectNeedsPanel';
import { DEFAULT_PROJECT_STANDARDS } from '../data/projectStandards';
import {
  buildPlatformInvestmentSeries,
  buildProjectChartSeries,
  computeProjectInvestmentMetrics,
} from '../lib/ledgerMath';

export const ProjectsEmploymentView: React.FC = () => {
  const {
    currentProfile,
    isAdmin,
    profiles,
    projects,
    hierarchyItems,
    employmentPostings,
    listings,
    orders,
    investments,
    projectReports,
    systemConfig,
    createProject,
    joinOrRequestProject,
    approveProjectMember,
    addHierarchyItem,
    voteHierarchyItem,
    assignHierarchyUids,
    submitExecutionReport,
    investInProject,
    updateProjectInvestmentConfig,
    submitProjectInvestmentReport,
    createJobPosting,
    applyToJob,
    inviteToJob,
    updateJobApplicantStatus,
    setInspectedUid,
  } = useAlirada();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId) setSelectedProjectId('');
      return;
    }
    if (!projects.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);
  const [viewMode, setViewMode] = useState<'projects' | 'needs'>('projects');
  const [subTab, setSubTab] = useState<'hierarchy' | 'investments' | 'jobs'>('hierarchy');
  const [showPlatformDiagram, setShowPlatformDiagram] = useState(true);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const projectStandards = useMemo(
    () =>
      systemConfig.project_standards && systemConfig.project_standards.length > 0
        ? systemConfig.project_standards
        : DEFAULT_PROJECT_STANDARDS,
    [systemConfig.project_standards]
  );

  const standardCategories = useMemo(
    () => Array.from(new Set(projectStandards.map((s) => s.category))),
    [projectStandards]
  );

  // Create Project Form
  const [pName, setPName] = useState('');
  const [pCat, setPCat] = useState(standardCategories[0] || 'Energy');
  const [pType, setPType] = useState(
    projectStandards.find((s) => s.category === (standardCategories[0] || 'Energy'))?.project_type ||
      'Solar Plant'
  );
  const [pDesc, setPDesc] = useState('');
  const [pVis, setPVis] = useState<'Public' | 'Private'>('Public');
  const [pDistrict, setPDistrict] = useState('');
  const [pCity, setPCity] = useState('');
  const [pCountry, setPCountry] = useState('');
  const [pLoc, setPLoc] = useState('');
  const [pGoal, setPGoal] = useState(0);
  const [pBudgetDoc, setPBudgetDoc] = useState('');
  const [pPresUrl, setPPresUrl] = useState('');

  const availableProjectTypesForCat = useMemo(() => {
    const matched = projectStandards.filter((s) => s.category === pCat);
    return matched.length > 0 ? matched : projectStandards;
  }, [projectStandards, pCat]);

  // Project Investment & Shareholder Report Modals
  const [investModalOpen, setInvestModalOpen] = useState(false);
  const [investAmount, setInvestAmount] = useState(100);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [cfgGoal, setCfgGoal] = useState(0);
  const [cfgBudgetDoc, setCfgBudgetDoc] = useState('');
  const [cfgPresUrl, setCfgPresUrl] = useState('');
  const [cfgStatus, setCfgStatus] = useState<'Open' | 'Deactivated' | 'Closed'>('Open');

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [repTitle, setRepTitle] = useState('');
  const [repSummary, setRepSummary] = useState('');
  const [repCost, setRepCost] = useState(0);
  const [repIncome, setRepIncome] = useState(0);
  const [repLinks, setRepLinks] = useState<ProjectInvestmentReportLink[]>([
    { label: 'Milestone Evidence / Sheet', url: '' },
  ]);

  // Quick Add Hierarchy Modal
  const [addHierarchyModal, setAddHierarchyModal] = useState<{
    level: 'Function' | 'Step' | 'Fix';
    functionName: string;
    stepTitle?: string;
  } | null>(null);
  const [hTitle, setHTitle] = useState('');
  const [hDesc, setHDesc] = useState('');
  const [hCost, setHCost] = useState(50);

  // Assign & Execute Modals
  const [assignModalItem, setAssignModalItem] = useState<ProjectHierarchyItem | null>(null);
  const [assignRaw, setAssignRaw] = useState('');
  const [execModalItem, setExecModalItem] = useState<ProjectHierarchyItem | null>(null);
  const [execHours, setExecHours] = useState(2);
  const [execHardship, setExecHardship] = useState(5);
  const [execSummary, setExecSummary] = useState('');

  // Job Post & Apply Modals
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [jTitle, setJTitle] = useState('');
  const [jQuals, setJQuals] = useState('');
  const [jTasks, setJTasks] = useState('');
  const [jLoc, setJLoc] = useState('');
  const [jCourses, setJCourses] = useState<string[]>([]);

  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [appPhone, setAppPhone] = useState('');
  const [appCv, setAppCv] = useState('');
  const [inviteUidMap, setInviteUidMap] = useState<Record<string, string>>({});

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const projectItems = useMemo(
    () => hierarchyItems.filter((i) => i.project_id === activeProject?.id),
    [hierarchyItems, activeProject]
  );

  // Strict nesting: Function -> Step -> Multiple Fixes[]
  const groupedHierarchy = useMemo(() => {
    const fnMap = new Map<
      string,
      {
        fnRoots: ProjectHierarchyItem[];
        steps: {
          stepTitle: string;
          stepItem?: ProjectHierarchyItem;
          fixes: ProjectHierarchyItem[];
        }[];
      }
    >();

    projectItems.forEach((item) => {
      if (!fnMap.has(item.function_name)) {
        fnMap.set(item.function_name, { fnRoots: [], steps: [] });
      }
      const group = fnMap.get(item.function_name)!;
      if (!item.step_title) {
        group.fnRoots.push(item);
        return;
      }
      let stepGroup = group.steps.find((s) => s.stepTitle === item.step_title);
      if (!stepGroup) {
        stepGroup = { stepTitle: item.step_title, fixes: [] };
        group.steps.push(stepGroup);
      }
      if (item.fix_title) {
        stepGroup.fixes.push(item);
      } else {
        stepGroup.stepItem = item;
      }
    });

    return Array.from(fnMap.entries());
  }, [projectItems]);

  const projectJobs = useMemo(
    () => employmentPostings.filter((j) => j.project_id === activeProject?.id),
    [employmentPostings, activeProject]
  );

  const platformAnalytics = useMemo(
    () => buildPlatformInvestmentSeries(investments, projectReports, orders, listings),
    [investments, projectReports, orders, listings]
  );

  const activeInvMetrics = useMemo(() => {
    if (!activeProject) return null;
    return computeProjectInvestmentMetrics(
      activeProject.id,
      listings,
      orders,
      investments,
      projectReports
    );
  }, [activeProject, listings, orders, investments, projectReports]);

  const activeChartSeries = useMemo(() => {
    if (!activeProject) return [];
    return buildProjectChartSeries(
      activeProject.id,
      activeProject.created_at,
      listings,
      orders,
      investments,
      projectReports
    );
  }, [activeProject, listings, orders, investments, projectReports]);

  const activeProjectReports = useMemo(
    () =>
      activeProject
        ? projectReports
            .filter((r) => r.project_id === activeProject.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
        : [],
    [projectReports, activeProject]
  );

  const activeProjectInvestments = useMemo(
    () =>
      activeProject
        ? investments.filter(
            (i) => i.project_id === activeProject.id || i.listing_id === activeProject.id
          )
        : [],
    [investments, activeProject]
  );

  const linkedListings = useMemo(
    () =>
      activeProject ? listings.filter((l) => l.linked_project_id === activeProject.id) : [],
    [listings, activeProject]
  );

  const courseListings = useMemo(
    () => listings.filter((l) => l.listing_type === 'Course'),
    [listings]
  );

  const isLeader = Boolean(
    activeProject &&
      (activeProject.owner_uid === currentProfile.universal_id ||
        activeProject.elected_ceo_uid === currentProfile.universal_id)
  );

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await createProject({
      name: pName,
      category: pCat,
      project_type: pType,
      description: pDesc,
      visibility: pVis,
      district: pDistrict,
      city: pCity,
      country: pCountry,
      location: pLoc,
      investment_goal_points: Number(pGoal) || undefined,
      budget_doc_url: pBudgetDoc || undefined,
      presentation_url: pPresUrl || undefined,
    });
    if (ok) {
      setCreateProjectOpen(false);
      setPName('');
      setPDesc('');
      setPDistrict('');
      setPCity('');
      setPCountry('');
      setPLoc('');
      setPGoal(0);
      setPBudgetDoc('');
      setPPresUrl('');
    }
  };

  const handleCreateNeededProject = (preset: {
    category: string;
    project_type: string;
    district?: string;
    city?: string;
    country?: string;
  }) => {
    setPCat(preset.category);
    setPType(preset.project_type);
    setPDistrict(preset.district || '');
    setPCity(preset.city || '');
    setPCountry(preset.country || '');
    setPName(
      `${preset.project_type}${preset.district ? ` (${preset.district})` : preset.city ? ` (${preset.city})` : ''}`
    );
    setCreateProjectOpen(true);
  };

  const openConfigModal = () => {
    if (!activeProject) return;
    setCfgGoal(activeProject.investment_goal_points || 0);
    setCfgBudgetDoc(activeProject.budget_doc_url || '');
    setCfgPresUrl(activeProject.presentation_url || '');
    setCfgStatus(activeProject.investment_status || 'Open');
    setConfigModalOpen(true);
  };

  const handleSaveInvConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    const ok = await updateProjectInvestmentConfig(activeProject.id, {
      investment_goal_points: Number(cfgGoal),
      budget_doc_url: cfgBudgetDoc,
      presentation_url: cfgPresUrl,
      investment_status: cfgStatus,
    });
    if (ok) setConfigModalOpen(false);
  };

  const handleInvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    const ok = await investInProject(activeProject, Number(investAmount));
    if (ok) {
      setInvestModalOpen(false);
      setInvestAmount(100);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    const ok = await submitProjectInvestmentReport({
      project: activeProject,
      title: repTitle,
      summary_text: repSummary,
      links: repLinks,
      period_cost_points: Number(repCost),
      period_income_points: Number(repIncome),
    });
    if (ok) {
      setReportDialogOpen(false);
      setRepTitle('');
      setRepSummary('');
      setRepCost(0);
      setRepIncome(0);
      setRepLinks([{ label: 'Milestone Evidence / Sheet', url: '' }]);
    }
  };

  const handleAddHierarchy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !addHierarchyModal) return;
    const ok = await addHierarchyItem({
      project_id: activeProject.id,
      function_name:
        addHierarchyModal.level === 'Function' ? hTitle : addHierarchyModal.functionName,
      step_title:
        addHierarchyModal.level === 'Step'
          ? hTitle
          : addHierarchyModal.level === 'Fix'
            ? addHierarchyModal.stepTitle
            : undefined,
      fix_title: addHierarchyModal.level === 'Fix' ? hTitle : undefined,
      description: hDesc,
      estimated_cost: Number(hCost),
    });
    if (ok) {
      setAddHierarchyModal(null);
      setHTitle('');
      setHDesc('');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalItem) return;
    const uids = assignRaw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    await assignHierarchyUids(assignModalItem.id, uids);
    setAssignModalItem(null);
  };

  const handleExecSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!execModalItem || !activeProject) return;
    const ok = await submitExecutionReport(
      execModalItem,
      activeProject,
      Number(execHours),
      Number(execHardship),
      execSummary
    );
    if (ok) {
      setExecModalItem(null);
      setExecSummary('');
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    const ok = await createJobPosting({
      project_id: activeProject.id,
      position_title: jTitle,
      qualifications: jQuals,
      tasks_summary: jTasks,
      required_course_ids: jCourses,
      location: jLoc,
    });
    if (ok) {
      setCreateJobOpen(false);
      setJTitle('');
      setJQuals('');
      setJTasks('');
    }
  };

  const handleApplyJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyJobId) return;
    const ok = await applyToJob(applyJobId, appPhone, appCv);
    if (ok) {
      setApplyJobId(null);
      setAppPhone('');
      setAppCv('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-stone-900 dark:text-stone-100">
            Projects, Investments & Employment
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Function → Step → Multiple Fixes · Project shareholder rounds, reports & linked product income
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('projects')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'projects'
                  ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Projects ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('needs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'needs'
                  ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Community Needs &amp; Priorities
            </button>
          </div>
          {viewMode === 'projects' && (
            <button
              type="button"
              onClick={() => setShowPlatformDiagram((v) => !v)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#B88B1E] dark:text-[#D4AF37]" />
              {showPlatformDiagram ? 'Hide Platform Diagram' : 'Show Platform Diagram'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateProjectOpen(true)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 inline-flex items-center gap-1.5 self-start whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {viewMode === 'needs' && (
        <CommunityProjectNeedsPanel
          standards={projectStandards}
          projects={projects}
          onCreateNeededProject={handleCreateNeededProject}
        />
      )}

      {/* Platform-Wide Accumulated Investment & Income Diagram */}
      {viewMode === 'projects' && showPlatformDiagram && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">Platform Invested Capital</p>
              <p className="text-xl font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                {platformAnalytics.totalInvested} pts
              </p>
            </div>
            <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">Total Accumulated Income</p>
              <p className="text-xl font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                {platformAnalytics.totalIncome} pts
              </p>
            </div>
            <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">Total Accumulated Cost</p>
              <p className="text-xl font-mono-tabular font-bold text-rose-700 dark:text-rose-400">
                {platformAnalytics.totalCost} pts
              </p>
            </div>
            <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">Real-Time Listing Income</p>
              <p className="text-xl font-mono-tabular font-bold text-stone-900 dark:text-stone-100">
                {platformAnalytics.realTimeListingIncome} pts
              </p>
            </div>
          </div>

          <InvestmentAnalyticsChart
            points={platformAnalytics.points}
            title="General Platform Investment & Income Diagram"
            subtitle="All accumulated investments, reported costs, shareholder reports, and real-time linked listing income across Alirada"
            showInvested
          />
        </div>
      )}

      {/* Project Selector Strip */}
      {viewMode === 'projects' && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.map((prj) => {
          const isSelected = activeProject?.id === prj.id;
          const isMember = prj.members.includes(currentProfile.universal_id);
          const m = computeProjectInvestmentMetrics(prj.id, listings, orders, investments, projectReports);
          return (
            <div
              key={prj.id}
              onClick={() => setSelectedProjectId(prj.id)}
              className={`cursor-pointer bg-white dark:bg-[#12151B] border rounded-xl p-4 space-y-2 transition-colors ${
                isSelected
                  ? 'border-[#B88B1E] dark:border-[#D4AF37]'
                  : 'border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                <span className="font-mono-tabular">{prj.project_code}</span>
                <span>{prj.visibility} · {prj.members.length} members</span>
              </div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{prj.name}</h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2">{prj.description}</p>
              {(prj.investment_goal_points || 0) > 0 && (
                <p className="text-[11px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                  Invested: {m.totalInvested} / {prj.investment_goal_points} pts · Income: {m.totalAccumulatedIncome} pts
                </p>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-stone-500">
                  CEO:{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectedUid(prj.elected_ceo_uid || prj.owner_uid);
                    }}
                    className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                    title="View CEO UID Profile"
                  >
                    {prj.elected_ceo_uid || prj.owner_uid}
                  </button>
                </span>
                {!isMember && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      joinOrRequestProject(prj);
                    }}
                    className="text-xs font-medium text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                  >
                    {prj.visibility === 'Public' ? 'Join Project' : 'Request Join'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {viewMode === 'projects' && activeProject && (
        <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <FolderKanban className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
                <h2 className="font-cinzel text-lg font-bold text-stone-900 dark:text-stone-100">
                  {activeProject.name}
                </h2>
                <span className="text-xs font-mono-tabular text-stone-500">
                  {activeProject.project_code}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Owner:{' '}
                <button
                  type="button"
                  onClick={() => setInspectedUid(activeProject.owner_uid)}
                  className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                >
                  {activeProject.owner_uid}
                </button>{' '}
                · Elected CEO:{' '}
                <button
                  type="button"
                  onClick={() => setInspectedUid(activeProject.elected_ceo_uid || activeProject.owner_uid)}
                  className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                >
                  {activeProject.elected_ceo_uid || activeProject.owner_uid}
                </button>{' '}
                · {activeProject.category}
                {activeProject.project_type ? ` · ${activeProject.project_type}` : ''}
                {activeProject.location ? ` · ${activeProject.location}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-[#0B0D10] rounded-lg">
                <button
                  type="button"
                  onClick={() => setSubTab('hierarchy')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    subTab === 'hierarchy'
                      ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  Functions, Steps & Fixes ({projectItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('investments')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    subTab === 'investments'
                      ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  Investments & Reports ({activeProjectReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('jobs')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    subTab === 'jobs'
                      ? 'bg-white dark:bg-[#1D222C] text-stone-900 dark:text-stone-100 shadow-sm'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  Employment ({projectJobs.length})
                </button>
              </div>
            </div>
          </div>

          {/* Pending Join Requests for Owner/CEO */}
          {isLeader && activeProject.join_requests.length > 0 && (
            <div className="p-3 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 flex items-center justify-between flex-wrap gap-3 text-xs">
              <span className="font-medium text-stone-700 dark:text-stone-300">
                Pending Join Requests:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {activeProject.join_requests.map((uid) => (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => approveProjectMember(activeProject.id, uid)}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    Approve {uid}
                  </button>
                ))}
              </div>
            </div>
          )}

          {subTab === 'hierarchy' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Vote Agree / Disagree on proposed work, add multiple Fixes under any Step, assign UIDs, and submit execution logs directly to the Service Ledger.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setAddHierarchyModal({ level: 'Function', functionName: '' })
                  }
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Function
                </button>
              </div>

              {groupedHierarchy.length === 0 ? (
                <p className="text-sm text-stone-500 py-8 text-center">
                  No functions defined yet. Click &ldquo;Add Function&rdquo; to start structuring this project.
                </p>
              ) : (
                <div className="space-y-6">
                  {groupedHierarchy.map(([fnName, group]) => (
                    <div
                      key={fnName}
                      className="border border-stone-200 dark:border-stone-800 rounded-xl p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-stone-200 dark:border-stone-800 pb-2">
                        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          Function: {fnName}
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setAddHierarchyModal({ level: 'Step', functionName: fnName })
                          }
                          className="text-xs text-[#B88B1E] dark:text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Step
                        </button>
                      </div>

                      {/* Function-level root items (if any) */}
                      {group.fnRoots.map((item) => {
                        const agreeCount = Object.values(item.votes).filter((v) => v === 'Agree').length;
                        const disagreeCount = Object.values(item.votes).filter((v) => v === 'Disagree').length;
                        return (
                          <div key={item.id} className="py-2 border-b border-stone-100 dark:border-stone-800/70 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="text-xs text-stone-500 font-mono-tabular">
                                  {item.task_code} · Function Root · {item.approval_status} · {item.execution_status}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap shrink-0">
                                <button
                                  type="button"
                                  onClick={() => voteHierarchyItem(item.id, 'Agree')}
                                  className="px-2.5 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 hover:border-emerald-500 inline-flex items-center gap-1 font-mono-tabular"
                                >
                                  <ThumbsUp className="w-3 h-3 text-emerald-600" /> {agreeCount}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => voteHierarchyItem(item.id, 'Disagree')}
                                  className="px-2.5 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 hover:border-rose-500 inline-flex items-center gap-1 font-mono-tabular"
                                >
                                  <ThumbsDown className="w-3 h-3 text-rose-600" /> {disagreeCount}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Steps & Nested Multiple Fixes */}
                      <div className="space-y-4">
                        {group.steps.map((stepGroup) => {
                          const stepItem = stepGroup.stepItem;
                          const stepAgree = stepItem
                            ? Object.values(stepItem.votes).filter((v) => v === 'Agree').length
                            : 0;
                          const stepDisagree = stepItem
                            ? Object.values(stepItem.votes).filter((v) => v === 'Disagree').length
                            : 0;
                          return (
                            <div
                              key={stepGroup.stepTitle}
                              className="rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 p-3.5 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  {stepItem && (
                                    <p className="text-xs text-stone-500 dark:text-stone-400 font-mono-tabular">
                                      {stepItem.task_code} · {stepItem.approval_status} · {stepItem.execution_status}
                                      {stepItem.estimated_cost ? ` · Est. ${stepItem.estimated_cost} pts` : ''}
                                    </p>
                                  )}
                                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                                    Step: {stepGroup.stepTitle}
                                    <span className="ms-2 text-xs font-normal text-stone-500">
                                      ({stepGroup.fixes.length} {stepGroup.fixes.length === 1 ? 'Fix' : 'Fixes'})
                                    </span>
                                  </p>
                                  {stepItem?.description && (
                                    <p className="text-xs text-stone-600 dark:text-stone-300">
                                      {stepItem.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAddHierarchyModal({
                                        level: 'Fix',
                                        functionName: fnName,
                                        stepTitle: stepGroup.stepTitle,
                                      })
                                    }
                                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-[#B88B1E]/50 dark:border-[#D4AF37]/50 text-[#B88B1E] dark:text-[#D4AF37] hover:bg-[#B88B1E]/10"
                                  >
                                    + Add Fix
                                  </button>
                                  {stepItem && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => voteHierarchyItem(stepItem.id, 'Agree')}
                                        className="px-2.5 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 hover:border-emerald-500 inline-flex items-center gap-1 font-mono-tabular"
                                      >
                                        <ThumbsUp className="w-3 h-3 text-emerald-600" /> {stepAgree}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => voteHierarchyItem(stepItem.id, 'Disagree')}
                                        className="px-2.5 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 hover:border-rose-500 inline-flex items-center gap-1 font-mono-tabular"
                                      >
                                        <ThumbsDown className="w-3 h-3 text-rose-600" /> {stepDisagree}
                                      </button>
                                      {isLeader && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAssignModalItem(stepItem);
                                            setAssignRaw(stepItem.assigned_uids.join(', '));
                                          }}
                                          className="px-2.5 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700"
                                        >
                                          Assign
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setExecModalItem(stepItem)}
                                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 inline-flex items-center gap-1"
                                      >
                                        <CheckCircle2 className="w-3 h-3" /> Log Execution
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {stepItem && stepItem.assigned_uids.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-stone-500">
                                  <span>Step Assigned:</span>
                                  {stepItem.assigned_uids.map((uid) => (
                                    <UserAvatar key={uid} universalId={uid} showUid />
                                  ))}
                                </div>
                              )}

                              {/* Multiple Fixes under this Step */}
                              {stepGroup.fixes.length > 0 && (
                                <div className="border-s-2 border-stone-200 dark:border-stone-700 ps-4 space-y-2.5 pt-1">
                                  {stepGroup.fixes.map((fixItem) => {
                                    const fixAgree = Object.values(fixItem.votes).filter((v) => v === 'Agree').length;
                                    const fixDisagree = Object.values(fixItem.votes).filter((v) => v === 'Disagree').length;
                                    return (
                                      <div
                                        key={fixItem.id}
                                        className="p-3 rounded-lg bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 space-y-2"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="space-y-0.5">
                                            <p className="text-[11px] font-mono-tabular text-stone-500">
                                              {fixItem.task_code} · {fixItem.approval_status} · {fixItem.execution_status}
                                              {fixItem.estimated_cost ? ` · Est. ${fixItem.estimated_cost} pts` : ''}
                                            </p>
                                            <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                                              Fix: {fixItem.fix_title}
                                            </p>
                                            {fixItem.description && (
                                              <p className="text-xs text-stone-600 dark:text-stone-300">
                                                {fixItem.description}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => voteHierarchyItem(fixItem.id, 'Agree')}
                                              className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 hover:border-emerald-500 inline-flex items-center gap-1 font-mono-tabular"
                                            >
                                              <ThumbsUp className="w-3 h-3 text-emerald-600" /> {fixAgree}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => voteHierarchyItem(fixItem.id, 'Disagree')}
                                              className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 hover:border-rose-500 inline-flex items-center gap-1 font-mono-tabular"
                                            >
                                              <ThumbsDown className="w-3 h-3 text-rose-600" /> {fixDisagree}
                                            </button>
                                            {isLeader && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setAssignModalItem(fixItem);
                                                  setAssignRaw(fixItem.assigned_uids.join(', '));
                                                }}
                                                className="px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700"
                                              >
                                                Assign
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => setExecModalItem(fixItem)}
                                              className="px-2.5 py-1 text-xs font-medium rounded bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 inline-flex items-center gap-1"
                                            >
                                              <CheckCircle2 className="w-3 h-3" /> Log Execution
                                            </button>
                                          </div>
                                        </div>
                                        {fixItem.assigned_uids.length > 0 && (
                                          <div className="flex items-center gap-2 text-xs text-stone-500">
                                            <span>Assigned:</span>
                                            {fixItem.assigned_uids.map((uid) => (
                                              <UserAvatar key={uid} universalId={uid} showUid />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {subTab === 'investments' && activeInvMetrics && (
            <div className="space-y-6">
              {/* Project Investment Header & Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 text-xs text-stone-500 dark:text-stone-400">
                  <p>
                    Investment Round Status:{' '}
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      {activeProject.investment_status || 'Open'}
                    </span>{' '}
                    · Goal:{' '}
                    <span className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                      {activeProject.investment_goal_points || 0} pts
                    </span>{' '}
                    · Active Shareholders: {activeInvMetrics.shareCount}
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    {activeProject.budget_doc_url && (
                      <a
                        href={activeProject.budget_doc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#B88B1E] dark:text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Budget Sheet
                      </a>
                    )}
                    {activeProject.presentation_url && (
                      <a
                        href={activeProject.presentation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#B88B1E] dark:text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Project Presentation
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(activeProject.investment_goal_points || 0) > 0 &&
                    activeProject.investment_status !== 'Deactivated' &&
                    activeProject.investment_status !== 'Closed' && (
                      <button
                        type="button"
                        onClick={() => setInvestModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 inline-flex items-center gap-1.5"
                      >
                        <Coins className="w-3.5 h-3.5" /> Invest in Project
                      </button>
                    )}
                  {(isLeader || isAdmin) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setReportDialogOpen(true)}
                        className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Publish Shareholder Report
                      </button>
                      <button
                        type="button"
                        onClick={openConfigModal}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center gap-1.5"
                      >
                        <Settings className="w-3.5 h-3.5" /> Round Settings
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Project Financial Metrics Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-1.5">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Invested Capital</p>
                  <p className="text-lg font-mono-tabular font-bold text-[#B88B1E] dark:text-[#D4AF37]">
                    {activeInvMetrics.totalInvested} pts
                  </p>
                  {(activeProject.investment_goal_points || 0) > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-[#B88B1E] dark:bg-[#D4AF37]"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (activeInvMetrics.totalInvested /
                                (activeProject.investment_goal_points || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-1">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Total Accumulated Cost</p>
                  <p className="text-lg font-mono-tabular font-bold text-rose-700 dark:text-rose-400">
                    {activeInvMetrics.reportedCost} pts
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-1">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Linked Listing Income</p>
                  <p className="text-lg font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                    {activeInvMetrics.realTimeListingIncome} pts
                  </p>
                  {activeInvMetrics.pendingListingIncome > 0 && (
                    <p className="text-[11px] font-mono-tabular text-stone-500">
                      +{activeInvMetrics.pendingListingIncome} pts pending
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-1">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Total Accumulated Income</p>
                  <p className="text-lg font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                    {activeInvMetrics.totalAccumulatedIncome} pts
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-1">
                  <p className="text-xs text-stone-500 dark:text-stone-400">Net Position</p>
                  <p
                    className={`text-lg font-mono-tabular font-bold ${
                      activeInvMetrics.netPosition >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {activeInvMetrics.netPosition >= 0
                      ? `+${activeInvMetrics.netPosition}`
                      : activeInvMetrics.netPosition}{' '}
                    pts
                  </p>
                </div>
              </div>

              {/* Project Cumulative Cost & Income Diagram */}
              <InvestmentAnalyticsChart
                points={activeChartSeries}
                title={`Cumulative Cost & Income — ${activeProject.project_code}`}
                subtitle="Aggregates each shareholder report sequentially from inception until now, plus real-time linked listing revenue"
              />

              {/* Linked Marketplace Listings feeding real-time income */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Linked Marketplace Products & Services ({linkedListings.length})
                </h3>
                {linkedListings.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    No marketplace listings linked to this project yet. Listing owners can link products/services when creating a listing to stream real-time order income here.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                          <th className="py-2 pe-3 font-medium">Listing</th>
                          <th className="py-2 pe-3 font-medium">Owner</th>
                          <th className="py-2 pe-3 text-end font-medium">Delivered Income</th>
                          <th className="py-2 text-end font-medium">Pending Orders</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                        {linkedListings.map((lst) => {
                          const deliveredPts = orders
                            .filter((o) => o.listing_id === lst.id && o.delivery_status === 'Delivered')
                            .reduce((acc, o) => acc + o.total_points, 0);
                          const pendingPts = orders
                            .filter(
                              (o) =>
                                o.listing_id === lst.id &&
                                o.order_status !== 'Rejected' &&
                                o.delivery_status !== 'Delivered'
                            )
                            .reduce((acc, o) => acc + o.total_points, 0);
                          return (
                            <tr key={lst.id}>
                              <td className="py-2.5 pe-3">
                                <span className="font-medium text-stone-900 dark:text-stone-100">
                                  {lst.title}
                                </span>{' '}
                                <span className="font-mono-tabular text-stone-500">
                                  ({lst.listing_code} · {lst.listing_type})
                                </span>
                              </td>
                              <td className="py-2.5 pe-3">
                                <UserAvatar universalId={lst.owner_uid} showUid />
                              </td>
                              <td className="py-2.5 pe-3 text-end font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                                +{deliveredPts} pts
                              </td>
                              <td className="py-2.5 text-end font-mono-tabular text-stone-500">
                                {pendingPts} pts
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Shareholder Reports Timeline */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Shareholder Progress & Financial Reports ({activeProjectReports.length})
                </h3>
                {activeProjectReports.length === 0 ? (
                  <p className="text-xs text-stone-500">No shareholder reports published yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activeProjectReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-4 rounded-xl bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 space-y-2 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] font-semibold">
                              {rep.report_code}
                            </span>{' '}
                            ·{' '}
                            <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                              {rep.title}
                            </span>
                          </div>
                          <span className="font-mono-tabular text-stone-500">
                            {rep.created_at.slice(0, 10)} · By {rep.author_uid}
                          </span>
                        </div>
                        <p className="text-stone-700 dark:text-stone-300 leading-relaxed">
                          {rep.summary_text}
                        </p>
                        <div className="flex flex-wrap gap-4 font-mono-tabular pt-1">
                          <span className="text-rose-700 dark:text-rose-400">
                            Period Cost: {rep.period_cost_points} pts (Cum: {rep.total_accumulated_cost} pts)
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Period Income: {rep.period_income_points} pts (Cum: {rep.total_accumulated_income} pts)
                          </span>
                        </div>
                        {rep.links.length > 0 && (
                          <div className="flex flex-wrap gap-3 pt-1">
                            {rep.links.map((lnk, idx) => (
                              <a
                                key={`${rep.id}_lnk_${idx}`}
                                href={lnk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                {lnk.label || lnk.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Shareholders Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Project Shareholders ({activeProjectInvestments.length})
                </h3>
                {activeProjectInvestments.length === 0 ? (
                  <p className="text-xs text-stone-500">No investments recorded for this project yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                          <th className="py-2 pe-3 font-medium">Code</th>
                          <th className="py-2 pe-3 font-medium">Shareholder</th>
                          <th className="py-2 pe-3 text-end font-medium">Invested</th>
                          <th className="py-2 pe-3 text-end font-medium">Share %</th>
                          <th className="py-2 text-end font-medium">Dividends Earned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800/70">
                        {activeProjectInvestments.map((inv) => (
                          <tr key={inv.id}>
                            <td className="py-2.5 pe-3 font-mono-tabular">{inv.investment_code}</td>
                            <td className="py-2.5 pe-3">
                              <UserAvatar universalId={inv.investor_uid} showName showUid />
                            </td>
                            <td className="py-2.5 pe-3 text-end font-mono-tabular font-semibold">
                              {inv.invested_points} pts
                            </td>
                            <td className="py-2.5 pe-3 text-end font-mono-tabular">
                              {inv.share_percentage}%
                            </td>
                            <td className="py-2.5 text-end font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                              +{inv.dividends_earned} pts
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {subTab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Cooperative roles with required course prerequisites, CV applications, and direct member invites.
                </p>
                {isLeader && (
                  <button
                    type="button"
                    onClick={() => setCreateJobOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Post Position
                  </button>
                )}
              </div>

              {projectJobs.length === 0 ? (
                <p className="text-sm text-stone-500 py-8 text-center">No open positions for this project.</p>
              ) : (
                <div className="divide-y divide-stone-200 dark:divide-stone-800">
                  {projectJobs.map((job) => (
                    <div key={job.id} className="py-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-[#B88B1E] dark:text-[#D4AF37]" />
                            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                              {job.position_title}
                            </h3>
                            <span className="text-xs font-mono-tabular text-stone-500">
                              {job.job_code} · {job.status}
                            </span>
                          </div>
                          {job.location && (
                            <p className="text-xs text-stone-500 dark:text-stone-400">{job.location}</p>
                          )}
                          {job.qualifications && (
                            <p className="text-xs text-stone-600 dark:text-stone-300">
                              Qualifications: {job.qualifications}
                            </p>
                          )}
                          {job.required_course_ids.length > 0 && (
                            <p className="text-xs text-[#B88B1E] dark:text-[#D4AF37] font-mono-tabular">
                              Required Courses: {job.required_course_ids.join(', ')}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setApplyJobId(job.id)}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 shrink-0 self-start"
                        >
                          Apply with CV
                        </button>
                      </div>

                      {isLeader && (
                        <div className="space-y-3 pt-2 text-xs text-stone-500 border-t border-stone-100 dark:border-stone-800/70">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span>
                              Applicants: {job.applicants.length} · Invites: {job.invites.length}
                            </span>
                            <div className="flex items-center gap-2">
                              <select
                                value={inviteUidMap[job.id] || ''}
                                onChange={(e) =>
                                  setInviteUidMap((prev) => ({ ...prev, [job.id]: e.target.value }))
                                }
                                className="px-2.5 py-1 rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10] text-stone-900 dark:text-stone-100"
                              >
                                <option value="">Select UID to invite...</option>
                                {profiles.map((p) => (
                                  <option key={p.universal_id} value={p.universal_id}>
                                    {p.universal_id} — {p.full_name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const uid = inviteUidMap[job.id];
                                  if (uid) inviteToJob(job.id, uid);
                                }}
                                className="px-3 py-1 rounded-md border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200"
                              >
                                Send Invite
                              </button>
                            </div>
                          </div>

                          {job.applicants.length > 0 && (
                            <div className="space-y-2">
                              {job.applicants.map((app) => (
                                <div
                                  key={app.uid}
                                  className="p-2.5 rounded-lg bg-stone-50 dark:bg-[#0B0D10] border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <div className="space-y-0.5">
                                    <p className="font-medium text-stone-900 dark:text-stone-100">
                                      {app.full_name}{' '}
                                      <button
                                        type="button"
                                        onClick={() => setInspectedUid(app.uid)}
                                        className="notranslate font-mono-tabular text-[#B88B1E] dark:text-[#D4AF37] hover:underline"
                                        title="View Applicant UID Profile"
                                      >
                                        ({app.uid})
                                      </button>{' '}
                                      · <span className="text-stone-500">{app.status}</span>
                                    </p>
                                    <p className="text-stone-500 flex items-center gap-3 flex-wrap">
                                      <span>Contact: {app.contact_number}</span>
                                      {app.cv_link && (
                                        <a
                                          href={app.cv_link}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[#B88B1E] dark:text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                                        >
                                          View CV <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {(['Shortlisted', 'Accepted', 'Declined'] as const).map((st) => (
                                      <button
                                        key={st}
                                        type="button"
                                        disabled={app.status === st}
                                        onClick={() => updateJobApplicantStatus(job.id, app.uid, st)}
                                        className={`px-2.5 py-1 rounded border text-[11px] font-medium disabled:opacity-40 ${
                                          st === 'Accepted'
                                            ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10'
                                            : st === 'Declined'
                                              ? 'border-rose-600/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10'
                                              : 'border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200'
                                        }`}
                                      >
                                        {st === 'Accepted'
                                          ? 'Accept'
                                          : st === 'Declined'
                                            ? 'Decline'
                                            : 'Shortlist'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {job.invites.length > 0 && (
                            <p className="text-[11px] text-stone-500">
                              Invited UIDs: {job.invites.map((i) => i.uid).join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {createProjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-lg font-bold">Create Cooperative Project</h3>
              <button onClick={() => setCreateProjectOpen(false)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder="Project Name"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Level-1 Category</label>
                  <select
                    value={pCat}
                    onChange={(e) => {
                      const nextCat = e.target.value;
                      setPCat(nextCat);
                      const firstMatch = projectStandards.find((s) => s.category === nextCat);
                      if (firstMatch) setPType(firstMatch.project_type);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  >
                    {standardCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Level-2 Project Type</label>
                  <select
                    value={pType}
                    onChange={(e) => setPType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  >
                    {availableProjectTypesForCat.map((item) => (
                      <option key={item.id} value={item.project_type}>
                        {item.project_type} (Min {item.min_per_district}/dist · {item.employees_per_project} emp)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium mb-1">District</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vauban"
                    value={pDistrict}
                    onChange={(e) => setPDistrict(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Freiburg"
                    value={pCity}
                    onChange={(e) => setPCity(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Country</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Germany"
                    value={pCountry}
                    onChange={(e) => setPCountry(e.target.value)}
                    className="w-full px-2.5 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={pVis}
                  onChange={(e) => setPVis(e.target.value as 'Public' | 'Private')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private (Request Join)</option>
                </select>
                <input
                  type="text"
                  placeholder="Street / Address Notes (Optional)"
                  value={pLoc}
                  onChange={(e) => setPLoc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <textarea
                rows={3}
                required
                placeholder="Project charter and scope..."
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
                <p className="font-semibold text-stone-700 dark:text-stone-300">
                  Optional Project Investment Round
                </p>
                <input
                  type="number"
                  min={0}
                  placeholder="Investment Goal (pts, 0 = none)"
                  value={pGoal}
                  onChange={(e) => setPGoal(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <input
                  type="url"
                  placeholder="Budget Sheet URL (Optional)"
                  value={pBudgetDoc}
                  onChange={(e) => setPBudgetDoc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <input
                  type="url"
                  placeholder="Presentation URL (Optional)"
                  value={pPresUrl}
                  onChange={(e) => setPPresUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Create Project
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invest in Project Modal */}
      {investModalOpen && activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-lg font-bold">
                Invest in {activeProject.project_code}
              </h3>
              <button onClick={() => setInvestModalOpen(false)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Shareholders earn proportional dividends from Delivered orders of Marketplace products/services linked to {activeProject.name} and receive every Shareholder Progress Report.
            </p>
            <form onSubmit={handleInvestSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Investment Amount (pts)</label>
                <input
                  type="number"
                  min={10}
                  required
                  value={investAmount}
                  onChange={(e) => setInvestAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Confirm {investAmount} pts Investment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Project Investment Config Modal */}
      {configModalOpen && activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-base font-bold">
                Project Investment Round Settings
              </h3>
              <button onClick={() => setConfigModalOpen(false)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveInvConfig} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Investment Goal (pts)</label>
                <input
                  type="number"
                  min={0}
                  value={cfgGoal}
                  onChange={(e) => setCfgGoal(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Round Status</label>
                <select
                  value={cfgStatus}
                  onChange={(e) => setCfgStatus(e.target.value as 'Open' | 'Deactivated' | 'Closed')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="Open">Open (Accepting Investments)</option>
                  <option value="Deactivated">Deactivated (Fulfill Existing Commitments)</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Budget Document URL</label>
                <input
                  type="url"
                  value={cfgBudgetDoc}
                  onChange={(e) => setCfgBudgetDoc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Presentation URL</label>
                <input
                  type="url"
                  value={cfgPresUrl}
                  onChange={(e) => setCfgPresUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Save Investment Round Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Publish Shareholder Report Dialog */}
      {reportDialogOpen && activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div>
                <h3 className="font-cinzel text-lg font-bold">Publish Shareholder Report</h3>
                <p className="text-xs text-stone-500">
                  Notifies all {activeInvMetrics?.shareCount || 0} active shareholders & updates cumulative analytics
                </p>
              </div>
              <button onClick={() => setReportDialogOpen(false)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReportSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Report Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q2 Solar Assembly & Distribution Revenue"
                  value={repTitle}
                  onChange={(e) => setRepTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Period Cost (pts)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={repCost}
                    onChange={(e) => setRepCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Period Income (pts)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={repIncome}
                    onChange={(e) => setRepIncome(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Report Text & Breakdown</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Share operational updates, costs incurred, and revenue milestones with shareholders..."
                  value={repSummary}
                  onChange={(e) => setRepSummary(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-medium">Supporting Links ({repLinks.length})</label>
                  <button
                    type="button"
                    onClick={() =>
                      setRepLinks((prev) => [...prev, { label: '', url: '' }])
                    }
                    className="text-[#B88B1E] dark:text-[#D4AF37] hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Link
                  </button>
                </div>
                {repLinks.map((lnk, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Label (e.g. Receipt PDF)"
                      value={lnk.label}
                      onChange={(e) =>
                        setRepLinks((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row))
                        )
                      }
                      className="col-span-4 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={lnk.url}
                      onChange={(e) =>
                        setRepLinks((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, url: e.target.value } : row))
                        )
                      }
                      className="col-span-7 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                    />
                    {repLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRepLinks((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 p-1 text-stone-400 hover:text-rose-600"
                        aria-label="Remove link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Publish & Notify Shareholders
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Function / Step / Fix Modal */}
      {addHierarchyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-lg font-bold">
                Add {addHierarchyModal.level}
              </h3>
              <button onClick={() => setAddHierarchyModal(null)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            {addHierarchyModal.functionName && (
              <p className="text-xs text-stone-500">
                Parent: {addHierarchyModal.functionName}
                {addHierarchyModal.stepTitle ? ` → ${addHierarchyModal.stepTitle}` : ''}
              </p>
            )}
            <form onSubmit={handleAddHierarchy} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder={`${addHierarchyModal.level} Title`}
                value={hTitle}
                onChange={(e) => setHTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <textarea
                rows={3}
                placeholder="Technical description..."
                value={hDesc}
                onChange={(e) => setHDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <input
                type="number"
                min={0}
                placeholder="Estimated Point Cost"
                value={hCost}
                onChange={(e) => setHCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Add {addHierarchyModal.level}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign UIDs Modal */}
      {assignModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-cinzel text-base font-bold">Assign Members ({assignModalItem.task_code})</h3>
              <button onClick={() => setAssignModalItem(null)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignSubmit} className="space-y-3 text-xs">
              <input
                type="text"
                value={assignRaw}
                onChange={(e) => setAssignRaw(e.target.value)}
                placeholder="UID-1, UID-2"
                className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Save Assignments
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Execution Report Modal */}
      {execModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-base font-bold">
                Log Execution ({execModalItem.task_code})
              </h3>
              <button onClick={() => setExecModalItem(null)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleExecSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Hours Spent</label>
                  <input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.5}
                    required
                    value={execHours}
                    onChange={(e) => setExecHours(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Hardship (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={execHardship}
                    onChange={(e) => setExecHardship(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono-tabular rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                  />
                </div>
              </div>
              <textarea
                rows={3}
                required
                placeholder="Describe completed execution deliverable..."
                value={execSummary}
                onChange={(e) => setExecSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Submit & Credit +{execHours * execHardship} pts
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      {createJobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-base font-bold">Post Employment Opening</h3>
              <button onClick={() => setCreateJobOpen(false)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder="Position Title"
                value={jTitle}
                onChange={(e) => setJTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <input
                type="text"
                placeholder="Location"
                value={jLoc}
                onChange={(e) => setJLoc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <textarea
                rows={2}
                placeholder="Qualifications..."
                value={jQuals}
                onChange={(e) => setJQuals(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <textarea
                rows={2}
                placeholder="Tasks summary..."
                value={jTasks}
                onChange={(e) => setJTasks(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              {courseListings.length > 0 && (
                <div>
                  <label className="block font-medium mb-1">Required Courses</label>
                  <div className="space-y-1">
                    {courseListings.map((c) => (
                      <label key={c.listing_code} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={jCourses.includes(c.listing_code)}
                          onChange={(e) =>
                            setJCourses((prev) =>
                              e.target.checked
                                ? [...prev, c.listing_code]
                                : prev.filter((id) => id !== c.listing_code)
                            )
                          }
                        />
                        <span>{c.listing_code} — {c.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Publish Job
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Apply to Job Modal */}
      {applyJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="font-cinzel text-base font-bold">Submit Employment Application</h3>
              <button onClick={() => setApplyJobId(null)} className="p-1 text-stone-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApplyJob} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder="Contact Number (+44...)"
                value={appPhone}
                onChange={(e) => setAppPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <input
                type="url"
                required
                placeholder="CV / Portfolio URL (https://...)"
                value={appCv}
                onChange={(e) => setAppCv(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950"
              >
                Submit Application
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
