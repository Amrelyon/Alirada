import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  Plus,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  X,
} from 'lucide-react';
import { useAlirada } from '../context/AliradaContext';
import { ProjectHierarchyItem } from '../types/alirada';
import { UserAvatar } from '../components/UserAvatar';

export const ProjectsEmploymentView: React.FC = () => {
  const {
    currentProfile,
    profiles,
    projects,
    hierarchyItems,
    employmentPostings,
    listings,
    systemConfig,
    createProject,
    joinOrRequestProject,
    approveProjectMember,
    addHierarchyItem,
    voteHierarchyItem,
    assignHierarchyUids,
    submitExecutionReport,
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
  const [subTab, setSubTab] = useState<'hierarchy' | 'jobs'>('hierarchy');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  // Create Project Form
  const [pName, setPName] = useState('');
  const [pCat, setPCat] = useState(systemConfig.custom_categories[0] || 'Energy & Infrastructure');
  const [pDesc, setPDesc] = useState('');
  const [pVis, setPVis] = useState<'Public' | 'Private'>('Public');
  const [pLoc, setPLoc] = useState('');

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

  // Group into Function -> Steps -> Fixes
  const groupedHierarchy = useMemo(() => {
    const fnMap = new Map<string, ProjectHierarchyItem[]>();
    projectItems.forEach((item) => {
      const list = fnMap.get(item.function_name) || [];
      list.push(item);
      fnMap.set(item.function_name, list);
    });
    return Array.from(fnMap.entries());
  }, [projectItems]);

  const projectJobs = useMemo(
    () => employmentPostings.filter((j) => j.project_id === activeProject?.id),
    [employmentPostings, activeProject]
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
      description: pDesc,
      visibility: pVis,
      location: pLoc,
    });
    if (ok) {
      setCreateProjectOpen(false);
      setPName('');
      setPDesc('');
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
            Projects & Employment Workspace
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Nested hierarchy: Project → Function → Step → Fix · Execution reports credit the Service Ledger
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateProjectOpen(true)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 hover:opacity-90 inline-flex items-center gap-1.5 self-start whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Project Selector Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.map((prj) => {
          const isSelected = activeProject?.id === prj.id;
          const isMember = prj.members.includes(currentProfile.universal_id);
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

      {activeProject && (
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
              <div className="flex justify-between items-center">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Vote Agree / Disagree on proposed work, assign UIDs, and submit execution logs directly to the Service Ledger.
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
                  {groupedHierarchy.map(([fnName, items]) => (
                    <div
                      key={fnName}
                      className="border border-stone-200 dark:border-stone-800 rounded-xl p-4 space-y-3"
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

                      <div className="divide-y divide-stone-100 dark:divide-stone-800/70">
                        {items.map((item) => {
                          const agreeCount = Object.values(item.votes).filter((v) => v === 'Agree').length;
                          const disagreeCount = Object.values(item.votes).filter((v) => v === 'Disagree').length;
                          return (
                            <div key={item.id} className="py-3 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <p className="text-xs text-stone-500 dark:text-stone-400 font-mono-tabular">
                                    {item.task_code} · {item.approval_status} · {item.execution_status}
                                    {item.estimated_cost ? ` · Est. ${item.estimated_cost} pts` : ''}
                                  </p>
                                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                                    {item.step_title ? `Step: ${item.step_title}` : 'Function Root'}
                                    {item.fix_title ? ` → Fix: ${item.fix_title}` : ''}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-stone-600 dark:text-stone-300">
                                      {item.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                  {item.step_title && !item.fix_title && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAddHierarchyModal({
                                          level: 'Fix',
                                          functionName: fnName,
                                          stepTitle: item.step_title,
                                        })
                                      }
                                      className="px-2.5 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                                    >
                                      + Fix
                                    </button>
                                  )}
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
                                  {isLeader && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAssignModalItem(item);
                                        setAssignRaw(item.assigned_uids.join(', '));
                                      }}
                                      className="px-2.5 py-1 text-xs rounded-md border border-stone-300 dark:border-stone-700"
                                    >
                                      Assign
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setExecModalItem(item)}
                                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#B88B1E] dark:bg-[#D4AF37] text-white dark:text-stone-950 inline-flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Log Execution
                                  </button>
                                </div>
                              </div>

                              {item.assigned_uids.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-stone-500">
                                  <span>Assigned:</span>
                                  {item.assigned_uids.map((uid) => (
                                    <UserAvatar key={uid} universalId={uid} showUid />
                                  ))}
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
          <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
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
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Category"
                  value={pCat}
                  onChange={(e) => setPCat(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                />
                <select
                  value={pVis}
                  onChange={(e) => setPVis(e.target.value as 'Public' | 'Private')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private (Request Join)</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Location (Optional)"
                value={pLoc}
                onChange={(e) => setPLoc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
              <textarea
                rows={3}
                required
                placeholder="Project charter and scope..."
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0B0D10]"
              />
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
