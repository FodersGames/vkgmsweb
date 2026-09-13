import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ClipboardList, Plus, Trash2, Edit3, BarChart3, Copy, Check, ExternalLink,
  ArrowLeft, Star, MessageSquare, CheckCircle, ChevronDown, ChevronUp,
  Share2, Users, FileText, Lock, Unlock, Eye, Sparkles, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

const QUESTION_TYPES = [
  { id: 'choice', label: 'Single Choice (Radio)' },
  { id: 'multiple_choice', label: 'Multiple Choice (Checkboxes)' },
  { id: 'rating', label: 'Rating (1-5 Stars)' },
  { id: 'text', label: 'Short Text' },
  { id: 'long_text', label: 'Paragraph (Long Text)' },
];

export const SurveysManagement = () => {
  const { token } = useAuth();

  // Navigation states: 'list' | 'create' | 'edit' | 'analytics'
  const [view, setView] = useState('list');
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Selected survey for analytics or editing
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [responsesList, setResponsesList] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState('summary'); // 'summary' | 'submissions'

  // Confirm dialog state
  const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null });

  // Builder Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    slug: '',
    status: 'active',
    allow_anonymous: true,
    questions: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/surveys`, { headers: authHeaders });
      setSurveys(res.data?.surveys || []);
    } catch (err) {
      toast.error('Failed to load surveys');
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const totalSurveys = surveys.length;
  const activeSurveys = surveys.filter(s => s.status === 'active').length;
  const totalResponses = surveys.reduce((acc, s) => acc + (s.responses_count || 0), 0);
  const avgResponses = totalSurveys > 0 ? (totalResponses / totalSurveys).toFixed(1) : 0;

  const handleCopyLink = (slug, id) => {
    const url = `${window.location.origin}/#/survey/${slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success('Public survey link copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Toggle active/closed status
  const handleToggleStatus = async (survey) => {
    const newStatus = survey.status === 'active' ? 'closed' : 'active';
    try {
      await axios.put(
        `${API_URL}/api/admin/surveys/${survey.id || survey.slug}`,
        { status: newStatus },
        { headers: authHeaders }
      );
      toast.success(`Survey marked as ${newStatus}`);
      fetchSurveys();
    } catch (err) {
      toast.error('Failed to update survey status');
    }
  };

  // Delete survey
  const handleDeleteClick = (survey) => {
    setDialog({
      open: true,
      title: 'Delete Survey',
      description: `Are you sure you want to delete "${survey.title}" and all its collected responses? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/api/admin/surveys/${survey.id || survey.slug}`, {
            headers: authHeaders,
          });
          toast.success('Survey deleted successfully');
          setDialog(d => ({ ...d, open: false }));
          fetchSurveys();
        } catch (err) {
          toast.error('Failed to delete survey');
          setDialog(d => ({ ...d, open: false }));
        }
      },
    });
  };

  // Open Builder for Create
  const handleOpenCreate = () => {
    setFormData({
      title: '',
      description: '',
      slug: '',
      status: 'active',
      allow_anonymous: true,
      questions: [
        {
          id: `q_1`,
          title: 'How satisfied are you with our latest update?',
          description: '',
          type: 'rating',
          options: [],
          required: true,
        },
        {
          id: `q_2`,
          title: 'Which features did you enjoy the most?',
          description: 'Select all that apply',
          type: 'multiple_choice',
          options: ['Gameplay & Mechanics', 'Visual Design & Graphics', 'Audio & Atmosphere', 'Performance'],
          required: false,
        },
        {
          id: `q_3`,
          title: 'What should we improve next?',
          description: 'Feel free to share any feedback or bug reports',
          type: 'long_text',
          options: [],
          required: false,
        },
      ],
    });
    setSelectedSurvey(null);
    setView('create');
  };

  // Open Builder for Edit
  const handleOpenEdit = (survey) => {
    setSelectedSurvey(survey);
    setFormData({
      title: survey.title || '',
      description: survey.description || '',
      slug: survey.slug || '',
      status: survey.status || 'active',
      allow_anonymous: survey.allow_anonymous !== false,
      questions: survey.questions || [],
    });
    setView('edit');
  };

  // Open Analytics View
  const handleOpenAnalytics = async (survey) => {
    setSelectedSurvey(survey);
    setAnalyticsLoading(true);
    setView('analytics');
    setAnalyticsTab('summary');
    try {
      const [statsRes, respRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/surveys/${survey.id || survey.slug}`, { headers: authHeaders }),
        axios.get(`${API_URL}/api/admin/surveys/${survey.id || survey.slug}/responses`, { headers: authHeaders }),
      ]);
      setAnalyticsData(statsRes.data?.analytics || null);
      setResponsesList(respRes.data?.responses || []);
    } catch (err) {
      toast.error('Failed to load survey analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Reload Analytics Data & Responses for selected survey
  const reloadAnalytics = async (surveyTarget) => {
    const s = surveyTarget || selectedSurvey;
    if (!s) return;
    try {
      const [statsRes, respRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/surveys/${s.id || s.slug}`, { headers: authHeaders }),
        axios.get(`${API_URL}/api/admin/surveys/${s.id || s.slug}/responses`, { headers: authHeaders }),
      ]);
      setAnalyticsData(statsRes.data?.analytics || null);
      const responses = respRes.data?.responses || [];
      setResponsesList(responses);
      setSelectedSurvey(prev => prev ? { ...prev, responses_count: responses.length } : prev);
      fetchSurveys();
    } catch (err) {
      console.error('Failed to reload analytics:', err);
    }
  };

  // Delete an individual response
  const handleDeleteResponse = (response) => {
    if (!selectedSurvey || !response) return;
    const respId = response.id;
    const author = response.username ? `@${response.username}` : 'Anonymous';

    setDialog({
      open: true,
      title: 'Supprimer la réponse',
      description: `Êtes-vous sûr de vouloir supprimer cette réponse de ${author} ? Cette action est irréversible et mettra à jour les statistiques du sondage.`,
      onConfirm: async () => {
        try {
          await axios.delete(
            `${API_URL}/api/admin/surveys/${selectedSurvey.id || selectedSurvey.slug}/responses/${respId}`,
            { headers: authHeaders }
          );
          toast.success('Réponse supprimée avec succès');
          setDialog(d => ({ ...d, open: false }));
          await reloadAnalytics(selectedSurvey);
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Erreur lors de la suppression de la réponse');
          setDialog(d => ({ ...d, open: false }));
        }
      },
    });
  };

  // Delete all responses for the survey
  const handleDeleteAllResponses = () => {
    if (!selectedSurvey) return;
    const count = responsesList.length;
    if (count === 0) {
      toast.info('Aucune réponse à supprimer');
      return;
    }

    setDialog({
      open: true,
      title: 'Supprimer toutes les réponses',
      description: `Êtes-vous sûr de vouloir supprimer définitivement les ${count} réponse(s) reçues pour ce sondage ? Les compteurs seront remis à 0. Cette action est irréversible.`,
      onConfirm: async () => {
        try {
          await axios.delete(
            `${API_URL}/api/admin/surveys/${selectedSurvey.id || selectedSurvey.slug}/responses`,
            { headers: authHeaders }
          );
          toast.success(`Toutes les réponses (${count}) ont été supprimées`);
          setDialog(d => ({ ...d, open: false }));
          await reloadAnalytics(selectedSurvey);
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Erreur lors de la suppression de toutes les réponses');
          setDialog(d => ({ ...d, open: false }));
        }
      },
    });
  };

  // Builder actions
  const handleAddQuestion = () => {
    const newId = `q_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: newId,
          title: 'New Question',
          description: '',
          type: 'choice',
          options: ['Option 1', 'Option 2'],
          required: false,
        },
      ],
    }));
  };

  const handleRemoveQuestion = (idx) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  };

  const handleMoveQuestion = (idx, direction) => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= formData.questions.length) return;
    const updated = [...formData.questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFormData(prev => ({ ...prev, questions: updated }));
  };

  const handleUpdateQuestion = (idx, field, value) => {
    setFormData(prev => {
      const updated = [...prev.questions];
      updated[idx] = { ...updated[idx], [field]: value };
      // Default options if switching to choice
      if (field === 'type' && (value === 'choice' || value === 'multiple_choice') && (!updated[idx].options || updated[idx].options.length === 0)) {
        updated[idx].options = ['Option 1', 'Option 2'];
      }
      return { ...prev, questions: updated };
    });
  };

  const handleAddOption = (qIdx) => {
    setFormData(prev => {
      const updated = [...prev.questions];
      const currentOpts = updated[qIdx].options || [];
      updated[qIdx] = {
        ...updated[qIdx],
        options: [...currentOpts, `Option ${currentOpts.length + 1}`],
      };
      return { ...prev, questions: updated };
    });
  };

  const handleUpdateOption = (qIdx, optIdx, text) => {
    setFormData(prev => {
      const updated = [...prev.questions];
      const opts = [...(updated[qIdx].options || [])];
      opts[optIdx] = text;
      updated[qIdx] = { ...updated[qIdx], options: opts };
      return { ...prev, questions: updated };
    });
  };

  const handleRemoveOption = (qIdx, optIdx) => {
    setFormData(prev => {
      const updated = [...prev.questions];
      const opts = (updated[qIdx].options || []).filter((_, i) => i !== optIdx);
      updated[qIdx] = { ...updated[qIdx], options: opts };
      return { ...prev, questions: updated };
    });
  };

  const handleSaveSurvey = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Survey title is required');
      return;
    }

    if (formData.questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    setSaving(true);
    try {
      if (view === 'create') {
        await axios.post(`${API_URL}/api/admin/surveys`, formData, { headers: authHeaders });
        toast.success('Survey created successfully');
      } else {
        await axios.put(
          `${API_URL}/api/admin/surveys/${selectedSurvey.id || selectedSurvey.slug}`,
          formData,
          { headers: authHeaders }
        );
        toast.success('Survey updated successfully');
      }
      fetchSurveys();
      setView('list');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save survey');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-white">
              Surveys & Forms
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
              Feedback Engine
            </span>
          </div>
          <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-1">
            Build Google Forms-style surveys, distribute shareable links, and monitor response metrics in real-time.
          </p>
        </div>

        {view === 'list' && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-sm font-medium transition-all shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Create Survey</span>
          </button>
        )}

        {view !== 'list' && (
          <button
            type="button"
            onClick={() => { setView('list'); fetchSurveys(); }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#181824] border border-[#D2D2D7] dark:border-[#2a2a3c] text-xs font-semibold text-[#1D1D1F] dark:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-all shrink-0 self-start sm:self-auto"
          >
            <ArrowLeft size={14} />
            <span>Back to All Surveys</span>
          </button>
        )}
      </div>

      {/* ── KPI METRICS CARDS ─────────────────────────────────── */}
      {view === 'list' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                Total Surveys
              </span>
              <ClipboardList size={16} className="text-[#FF6600]" />
            </div>
            <p className="text-2xl font-bold text-[#1D1D1F] dark:text-white">{totalSurveys}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                Active Forms
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeSurveys}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                Total Responses
              </span>
              <Users size={16} className="text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-[#1D1D1F] dark:text-white">{totalResponses}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                Avg Responses
              </span>
              <BarChart3 size={16} className="text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-[#1D1D1F] dark:text-white">{avgResponses}</p>
          </div>
        </div>
      )}

      {/* ── 1. SURVEYS LIST VIEW ───────────────────────────────── */}
      {view === 'list' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-[#86868B] dark:text-[#71717a] bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c]">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#FF6600]" />
              Loading surveys...
            </div>
          ) : surveys.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c]">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600]">
                <ClipboardList size={24} />
              </div>
              <h2 className="text-lg font-semibold text-[#1D1D1F] dark:text-white mb-1">
                No Surveys Yet
              </h2>
              <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mb-6 max-w-md mx-auto">
                Create your first feedback form to gather opinions, ratings, and detailed suggestions from players and community members.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-sm font-medium transition-all shadow-xs"
              >
                <Plus size={16} />
                <span>Create Your First Survey</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {surveys.map((survey) => {
                const isActive = survey.status === 'active';
                const count = survey.responses_count || 0;
                const questionsCount = (survey.questions || []).length;
                const isCopied = copiedId === (survey.id || survey.slug);

                return (
                  <div
                    key={survey.id || survey.slug}
                    className="p-6 rounded-2xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs flex flex-col justify-between hover:border-[#D2D2D7] dark:hover:border-[#3a3a4c] transition-all"
                  >
                    <div>
                      {/* Top Bar: Status and Questions badge */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(survey)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700'
                          }`}
                          title="Click to toggle active/closed"
                        >
                          {isActive ? <Unlock size={12} /> : <Lock size={12} />}
                          <span>{isActive ? 'Active' : 'Closed'}</span>
                        </button>

                        <span className="text-xs text-[#86868B] dark:text-[#71717a] font-medium">
                          {questionsCount} {questionsCount === 1 ? 'question' : 'questions'}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-lg font-bold text-[#1D1D1F] dark:text-white mb-1.5 leading-snug">
                        {survey.title}
                      </h3>
                      {survey.description && (
                        <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#a1a1aa] line-clamp-2 mb-4 leading-relaxed">
                          {survey.description}
                        </p>
                      )}

                      {/* Public Link Pill */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs mb-5">
                        <span className="text-[#86868B] dark:text-[#71717a] font-mono truncate flex-1">
                          /survey/{survey.slug}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(survey.slug, survey.id || survey.slug)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#151520] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border border-[#D2D2D7] dark:border-[#3a3a4c] text-[11px] font-medium text-[#1D1D1F] dark:text-white transition-all shrink-0"
                          title="Copy share link"
                        >
                          {isCopied ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <a
                          href={`/#/survey/${survey.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-[#86868B] dark:text-[#71717a] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                          title="Open public survey preview"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#E5E5EA] dark:border-[#2a2a3c]">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1D1F] dark:text-white">
                        <Users size={14} className="text-[#FF6600]" />
                        <span>{count} {count === 1 ? 'response' : 'responses'}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAnalytics(survey)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6600]/10 hover:bg-[#FF6600]/15 text-[#FF6600] text-xs font-semibold transition-colors"
                          title="Inspect detailed stats"
                        >
                          <BarChart3 size={14} />
                          <span>Stats</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(survey)}
                          className="p-1.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] hover:bg-[#E5E5EA] dark:hover:bg-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                          title="Edit Survey"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(survey)}
                          className="p-1.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] hover:bg-red-50 dark:hover:bg-red-950/40 text-[#6E6E73] dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete Survey"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 2. CREATE / EDIT SURVEY BUILDER ───────────────────── */}
      {(view === 'create' || view === 'edit') && (
        <form onSubmit={handleSaveSurvey} className="space-y-6 max-w-4xl">
          {/* Survey Metadata Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-[#1D1D1F] dark:text-white">
                {view === 'create' ? 'Create New Survey' : 'Edit Survey Details'}
              </h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#6E6E73] dark:text-[#a1a1aa]">
                  <input
                    type="checkbox"
                    checked={formData.status === 'active'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? 'active' : 'closed' }))}
                    className="rounded border-[#D2D2D7] text-[#FF6600] focus:ring-[#FF6600]"
                  />
                  <span>Active & Accepting Responses</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#71717a] mb-1.5">
                Survey Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Community Feedback & Alpha Playtest Survey"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#71717a] mb-1.5">
                Description / Instructions (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Give context to players on what this survey is about..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600] resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#86868B] dark:text-[#71717a] mb-1.5">
                  URL Slug (Optional, auto-generated if empty)
                </label>
                <div className="flex items-center rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] px-3">
                  <span className="text-xs text-[#86868B] dark:text-[#71717a] font-mono">/survey/</span>
                  <input
                    type="text"
                    placeholder="alpha-test-feedback"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-2 py-2.5 bg-transparent text-sm text-[#1D1D1F] dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#1D1D1F] dark:text-white">
                  <input
                    type="checkbox"
                    checked={formData.allow_anonymous}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_anonymous: e.target.checked }))}
                    className="rounded border-[#D2D2D7] text-[#FF6600] focus:ring-[#FF6600]"
                  />
                  <span>Allow anonymous submissions (no login required)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <span>Questions</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#E5E5EA] dark:bg-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa]">
                  {formData.questions.length}
                </span>
              </h3>

              <button
                type="button"
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6600]/10 hover:bg-[#FF6600]/20 text-[#FF6600] text-xs font-semibold transition-colors"
              >
                <Plus size={14} />
                <span>Add Question</span>
              </button>
            </div>

            {formData.questions.map((q, idx) => (
              <div
                key={q.id || idx}
                className="p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-4 relative"
              >
                {/* Question Header with Order Controls */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#FF6600] uppercase tracking-wider">
                    Question {idx + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveQuestion(idx, 'up')}
                      className="p-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#86868B] disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === formData.questions.length - 1}
                      onClick={() => handleMoveQuestion(idx, 'down')}
                      className="p-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#86868B] disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-[#86868B] hover:text-red-600 dark:hover:text-red-400 ml-1"
                      title="Remove question"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Question Title & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#86868B] dark:text-[#71717a] mb-1">
                      Question Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. How would you rate the controls?"
                      value={q.title}
                      onChange={(e) => handleUpdateQuestion(idx, 'title', e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#86868B] dark:text-[#71717a] mb-1">
                      Type
                    </label>
                    <select
                      value={q.type}
                      onChange={(e) => handleUpdateQuestion(idx, 'type', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600]"
                    >
                      {QUESTION_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subtitle / Description */}
                <div>
                  <input
                    type="text"
                    placeholder="Helper subtitle or description (optional)"
                    value={q.description || ''}
                    onChange={(e) => handleUpdateQuestion(idx, 'description', e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                {/* Options Builder (for Choice / Multiple Choice) */}
                {(q.type === 'choice' || q.type === 'multiple_choice') && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-medium text-[#86868B] dark:text-[#71717a]">
                      Choices / Options:
                    </label>
                    {(q.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <span className="text-xs text-[#86868B] w-5 text-right">{optIdx + 1}.</span>
                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => handleUpdateOption(idx, optIdx, e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs text-[#1D1D1F] dark:text-white focus:outline-none focus:border-[#FF6600]"
                        />
                        {(q.options || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx, optIdx)}
                            className="p-1 rounded-lg hover:bg-black/[0.05] text-[#86868B] hover:text-red-500"
                            title="Remove option"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddOption(idx)}
                      className="inline-flex items-center gap-1 text-xs text-[#FF6600] font-semibold hover:underline mt-1"
                    >
                      <Plus size={12} />
                      <span>Add Option</span>
                    </button>
                  </div>
                )}

                {/* Rating Preview */}
                {q.type === 'rating' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] text-xs text-[#86868B]">
                    <div className="flex items-center gap-1 text-[#FF6600]">
                      {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill="currentColor" />)}
                    </div>
                    <span>Users will rate on a 1 to 5 stars scale</span>
                  </div>
                )}

                {/* Bottom toggles */}
                <div className="flex items-center justify-end pt-2 border-t border-[#E5E5EA]/70 dark:border-[#2a2a3c]/70">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#6E6E73] dark:text-[#a1a1aa]">
                    <input
                      type="checkbox"
                      checked={!!q.required}
                      onChange={(e) => handleUpdateQuestion(idx, 'required', e.target.checked)}
                      className="rounded border-[#D2D2D7] text-[#FF6600] focus:ring-[#FF6600]"
                    />
                    <span>Required question</span>
                  </label>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddQuestion}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#FF6600] text-xs sm:text-sm font-semibold text-[#86868B] hover:text-[#FF6600] transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>Add Another Question</span>
            </button>
          </div>

          {/* Form Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setView('list')}
              className="px-5 py-2.5 rounded-xl bg-white dark:bg-[#181824] border border-[#D2D2D7] dark:border-[#2a2a3c] text-xs font-semibold text-[#1D1D1F] dark:text-white hover:bg-black/[0.03] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#E65C00] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Survey</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── 3. DETAILED ANALYTICS & STATS VIEW ────────────────── */}
      {view === 'analytics' && selectedSurvey && (
        <div className="space-y-6 max-w-5xl">
          {/* Survey Summary Header */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E5E5EA] dark:border-[#2a2a3c]">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-white">
                    {selectedSurvey.title}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedSurvey.status === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700'
                  }`}>
                    {selectedSurvey.status === 'active' ? 'Active' : 'Closed'}
                  </span>
                </div>
                {selectedSurvey.description && (
                  <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#a1a1aa] max-w-2xl leading-relaxed">
                    {selectedSurvey.description}
                  </p>
                )}
              </div>

              {/* Share link button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyLink(selectedSurvey.slug, 'analytics')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] hover:bg-[#E5E5EA] dark:hover:bg-[#2a2a3c] text-xs font-semibold text-[#1D1D1F] dark:text-white transition-all shrink-0"
                >
                  {copiedId === 'analytics' ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={14} />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <a
                  href={`/#/survey/${selectedSurvey.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                  title="View Public Form"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            {/* Quick KPIs under Header */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6">
              <div>
                <span className="text-xs font-medium text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                  Total Submissions
                </span>
                <p className="text-2xl sm:text-3xl font-bold text-[#1D1D1F] dark:text-white mt-0.5">
                  {analyticsData?.total_responses || 0}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                  Questions
                </span>
                <p className="text-2xl sm:text-3xl font-bold text-[#1D1D1F] dark:text-white mt-0.5">
                  {(selectedSurvey.questions || []).length}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-[#86868B] dark:text-[#71717a] uppercase tracking-wider">
                  Anonymous Mode
                </span>
                <p className="text-sm font-semibold text-[#1D1D1F] dark:text-white mt-2">
                  {selectedSurvey.allow_anonymous !== false ? 'Allowed' : 'Login Required'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation: Summary Analytics vs Submissions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5EA] dark:border-[#2a2a3c] pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAnalyticsTab('summary')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  analyticsTab === 'summary'
                    ? 'bg-[#FF6600] text-white shadow-xs'
                    : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                Summary & Question Breakdown
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsTab('submissions')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  analyticsTab === 'submissions'
                    ? 'bg-[#FF6600] text-white shadow-xs'
                    : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                Individual Submissions ({responsesList.length})
              </button>
            </div>

            {responsesList.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllResponses}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/25 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-all"
                title="Supprimer toutes les réponses de ce sondage"
              >
                <Trash2 size={13} />
                <span>Clear All Responses</span>
              </button>
            )}
          </div>

          {analyticsLoading ? (
            <div className="p-12 text-center text-[#86868B] bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c]">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#FF6600]" />
              Calculating analytics...
            </div>
          ) : analyticsTab === 'summary' ? (
            /* TAB 1: SUMMARY & QUESTION STATS */
            <div className="space-y-6">
              {analyticsData?.total_responses === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c]">
                  <MessageSquare size={32} className="mx-auto mb-3 text-[#86868B]" />
                  <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white mb-1">
                    No Responses Yet
                  </h3>
                  <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] max-w-sm mx-auto mb-4">
                    Share your public survey link with players to begin collecting feedback and real-time statistics.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(selectedSurvey.slug, 'empty')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6600] text-white text-xs font-semibold shadow-xs"
                  >
                    <Copy size={13} />
                    <span>Copy Survey Link</span>
                  </button>
                </div>
              ) : (
                (selectedSurvey.questions || []).map((q, idx) => {
                  const stats = analyticsData?.questions?.[q.id];

                  return (
                    <div
                      key={q.id || idx}
                      className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-[#1D1D1F] dark:text-white leading-snug">
                            <span className="text-[#86868B] font-normal mr-2">{idx + 1}.</span>
                            {q.title}
                          </h3>
                          {q.description && (
                            <p className="text-xs text-[#86868B] mt-0.5">{q.description}</p>
                          )}
                        </div>

                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F5F7] dark:bg-[#1e1e2d] text-[#6E6E73] dark:text-[#a1a1aa] shrink-0">
                          {stats?.answered_count || 0} answers
                        </span>
                      </div>

                      {/* Choice / Multiple Choice Bar Chart */}
                      {(q.type === 'choice' || q.type === 'multiple_choice') && stats?.options && (
                        <div className="space-y-3 pt-2">
                          {stats.options.map((opt, optIdx) => (
                            <div key={optIdx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-[#1D1D1F] dark:text-white">{opt.option}</span>
                                <span className="text-[#86868B] dark:text-[#71717a]">
                                  {opt.percentage}% ({opt.count} {opt.count === 1 ? 'vote' : 'votes'})
                                </span>
                              </div>
                              <div className="w-full h-3 rounded-full bg-[#F5F5F7] dark:bg-[#1e1e2d] overflow-hidden">
                                <div
                                  className="h-full bg-[#FF6600] rounded-full transition-all duration-500"
                                  style={{ width: `${opt.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rating Stats (Average + Histogram) */}
                      {q.type === 'rating' && stats && (
                        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                          {/* Average score big card */}
                          <div className="p-4 rounded-2xl bg-[#FF6600]/5 border border-[#FF6600]/20 text-center">
                            <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">
                              Average Rating
                            </span>
                            <div className="text-4xl font-extrabold text-[#FF6600] my-1">
                              {stats.average_rating}
                              <span className="text-lg font-normal text-[#86868B]"> / 5</span>
                            </div>
                            <div className="flex items-center justify-center gap-1 text-[#FF6600]">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  size={16}
                                  fill={star <= Math.round(stats.average_rating) ? 'currentColor' : 'none'}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Distribution breakdown */}
                          <div className="sm:col-span-2 space-y-2">
                            {(stats.distribution || []).slice().reverse().map(d => (
                              <div key={d.stars} className="flex items-center gap-3 text-xs">
                                <span className="w-12 text-right font-medium text-[#1D1D1F] dark:text-white flex items-center justify-end gap-1">
                                  <span>{d.stars}</span>
                                  <Star size={11} className="text-[#FF6600]" fill="currentColor" />
                                </span>
                                <div className="flex-1 h-2.5 rounded-full bg-[#F5F5F7] dark:bg-[#1e1e2d] overflow-hidden">
                                  <div
                                    className="h-full bg-[#FF6600] rounded-full transition-all duration-500"
                                    style={{ width: `${d.percentage}%` }}
                                  />
                                </div>
                                <span className="w-16 text-right text-[#86868B] dark:text-[#71717a]">
                                  {d.percentage}% ({d.count})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Text Answers Stream */}
                      {(q.type === 'text' || q.type === 'long_text') && (
                        <div className="pt-2 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {(stats?.feedbacks || []).length === 0 ? (
                            <p className="text-xs text-[#86868B] italic">No text answers submitted yet.</p>
                          ) : (
                            stats.feedbacks.map((item, fIdx) => (
                              <div
                                key={fIdx}
                                className="p-3.5 rounded-2xl bg-[#F5F5F7] dark:bg-[#1e1e2d] border border-[#E5E5EA] dark:border-[#2a2a3c] text-xs space-y-1 group"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[#1D1D1F] dark:text-white leading-relaxed flex-1">
                                    {item.text}
                                  </p>
                                  {item.id && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteResponse(item)}
                                      title="Supprimer cette réponse"
                                      className="p-1 rounded-lg text-[#86868B] hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors shrink-0"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-[#86868B] dark:text-[#71717a] pt-1 border-t border-[#E5E5EA]/60 dark:border-[#2a2a3c]/60">
                                  <span className="font-medium">@{item.username || 'Anonymous'}</span>
                                  <span>
                                    {new Date(item.submitted_at).toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* TAB 2: INDIVIDUAL SUBMISSIONS */
            <div className="space-y-4">
              {responsesList.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-[#151520] rounded-2xl border border-[#E5E5EA] dark:border-[#2a2a3c] text-[#86868B]">
                  No individual submissions to display.
                </div>
              ) : (
                responsesList.map((resp, rIdx) => (
                  <div
                    key={resp.id || rIdx}
                    className="p-6 rounded-3xl bg-white dark:bg-[#151520] border border-[#E5E5EA] dark:border-[#2a2a3c] shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA] dark:border-[#2a2a3c]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FF6600]/10 text-[#FF6600]">
                          Submission #{responsesList.length - rIdx}
                        </span>
                        <span className="text-xs font-semibold text-[#1D1D1F] dark:text-white">
                          @{resp.username || 'Anonymous'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#86868B] dark:text-[#71717a]">
                          {new Date(resp.submitted_at).toLocaleString('en-US')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteResponse(resp)}
                          title="Supprimer cette réponse"
                          className="p-1.5 rounded-xl text-[#86868B] hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Answers List */}
                    <div className="space-y-3">
                      {(selectedSurvey.questions || []).map((q, qIdx) => {
                        const ans = resp.answers?.[q.id];
                        let formattedAns = ans;
                        if (Array.isArray(ans)) {
                          formattedAns = ans.join(', ');
                        } else if (q.type === 'rating') {
                          formattedAns = `${ans} / 5 Stars`;
                        }

                        return (
                          <div key={q.id || qIdx} className="text-xs">
                            <span className="font-semibold text-[#86868B] block mb-0.5">
                              {qIdx + 1}. {q.title}
                            </span>
                            <div className="p-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#1e1e2d] text-[#1D1D1F] dark:text-white">
                              {formattedAns !== undefined && formattedAns !== null && formattedAns !== '' ? (
                                <span>{String(formattedAns)}</span>
                              ) : (
                                <span className="italic text-[#86868B]">Skipped / Not answered</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={dialog.open}
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        onConfirm={dialog.onConfirm}
        onClose={() => setDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
};
