import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Star, CheckCircle, WarningCircle, CircleNotch, ArrowLeft, PaperPlaneRight, LockKey } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { SiteFooter } from '../components/SiteFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

export default function PublicSurvey() {
  const { slug } = useParams();
  const { user } = useAuth();

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [answers, setAnswers] = useState({});
  const [respondentName, setRespondentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    fetchSurvey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchSurvey = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/public/surveys/${slug}`);
      if (res.data?.survey) {
        setSurvey(res.data.survey);
        document.title = `${res.data.survey.title} | Vakar Games`;
      } else {
        setError('Survey not found');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Survey not found or currently unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleChoiceSelect = (qId, option) => {
    setAnswers(prev => ({ ...prev, [qId]: option }));
    if (validationErrors[qId]) {
      setValidationErrors(prev => ({ ...prev, [qId]: null }));
    }
  };

  const handleMultipleChoiceToggle = (qId, option) => {
    const current = answers[qId] || [];
    let updated;
    if (current.includes(option)) {
      updated = current.filter(item => item !== option);
    } else {
      updated = [...current, option];
    }
    setAnswers(prev => ({ ...prev, [qId]: updated }));
    if (validationErrors[qId] && updated.length > 0) {
      setValidationErrors(prev => ({ ...prev, [qId]: null }));
    }
  };

  const handleRatingSelect = (qId, rating) => {
    setAnswers(prev => ({ ...prev, [qId]: rating }));
    if (validationErrors[qId]) {
      setValidationErrors(prev => ({ ...prev, [qId]: null }));
    }
  };

  const handleTextChange = (qId, text) => {
    setAnswers(prev => ({ ...prev, [qId]: text }));
    if (validationErrors[qId] && text.trim()) {
      setValidationErrors(prev => ({ ...prev, [qId]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!survey || survey.status === 'closed') return;

    // Validate required questions
    const errors = {};
    (survey.questions || []).forEach(q => {
      if (q.required) {
        const val = answers[q.id];
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          errors[q.id] = 'This field is required';
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Scroll to first error
      const firstErrorId = Object.keys(errors)[0];
      const element = document.getElementById(`question-${firstErrorId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/public/surveys/${slug}/submit`, {
        answers,
        username: user?.username || respondentName || 'Anonymous',
      });
      setSubmitted(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center p-6 text-center">
        <CircleNotch size={36} className="animate-spin text-[#FF6600] mb-4" />
        <p className="text-sm font-medium text-[#86868B]">Loading survey...</p>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col justify-between">
        <div className="pt-24 pb-16 max-w-xl mx-auto px-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <WarningCircle size={28} weight="bold" />
          </div>
          <h1 className="text-2xl font-semibold text-[#1D1D1F] mb-2">Survey Unavailable</h1>
          <p className="text-sm text-[#6E6E73] mb-8 leading-relaxed">
            {error || 'The requested survey could not be found or has expired.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1D1D1F] text-white text-sm font-medium hover:bg-black transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Return to Vakar Games</span>
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  // If survey is closed
  if (survey.status === 'closed') {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col justify-between">
        <div className="pt-24 pb-16 max-w-xl mx-auto px-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#E5E5EA] border border-[#D2D2D7] flex items-center justify-center text-[#6E6E73]">
            <LockKey size={28} weight="bold" />
          </div>
          <h1 className="text-2xl font-semibold text-[#1D1D1F] mb-2">{survey.title}</h1>
          <p className="text-sm text-[#6E6E73] mb-8 leading-relaxed">
            This survey is now closed and no longer accepting new responses. Thank you for your interest!
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1D1D1F] text-white text-sm font-medium hover:bg-black transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Return to Vakar Games</span>
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  // Submitted Thank You Screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col justify-between">
        <div className="pt-24 pb-16 max-w-xl mx-auto px-6 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
            <CheckCircle size={36} weight="fill" />
          </div>
          <h1 className="text-3xl font-semibold text-[#1D1D1F] tracking-tight mb-3">
            Response Submitted
          </h1>
          <p className="text-base text-[#6E6E73] mb-8 leading-relaxed">
            Thank you for taking the time to share your thoughts. Your feedback plays an essential role in refining Vakar Games productions.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1D1D1F] text-white text-sm font-medium hover:bg-black transition-colors shadow-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Vakar Games</span>
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  // Calculate completion percentage
  const totalQuestions = (survey.questions || []).length;
  const answeredCount = (survey.questions || []).filter(q => {
    const val = answers[q.id];
    return val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
  }).length;
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#E5E5EA]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-[#1D1D1F] tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6600] to-[#FF8533] flex items-center justify-center text-white font-black text-sm shadow-xs">
              V
            </div>
            <span>Vakar Games</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#86868B] font-medium hidden sm:inline">
              {answeredCount} of {totalQuestions} answered
            </span>
            <div className="w-24 h-2 bg-[#E5E5EA] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF6600] transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Survey Form */}
      <main className="max-w-3xl mx-auto px-6 py-10 w-full">
        {/* Survey Title Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E5E5EA] shadow-xs mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-[#FF6600]" />
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
            {survey.title}
          </h1>
          {survey.description && (
            <p className="text-sm sm:text-base text-[#6E6E73] leading-relaxed whitespace-pre-line">
              {survey.description}
            </p>
          )}

          {!user && (
            <div className="mt-6 pt-6 border-t border-[#E5E5EA]/70">
              <label className="block text-xs font-medium text-[#86868B] uppercase tracking-wider mb-2">
                Your Nickname or Tag (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Alex or Gamer99 (or leave blank to remain anonymous)"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] placeholder-[#86868B] focus:bg-white focus:border-[#FF6600] focus:ring-1 focus:ring-[#FF6600] outline-none transition-all"
              />
            </div>
          )}
        </div>

        {/* Questions List */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {(survey.questions || []).map((q, idx) => {
            const hasError = !!validationErrors[q.id];
            return (
              <div
                key={q.id}
                id={`question-${q.id}`}
                className={`bg-white rounded-3xl p-7 sm:p-8 border transition-all shadow-xs ${
                  hasError ? 'border-red-400 ring-2 ring-red-100' : 'border-[#E5E5EA]'
                }`}
              >
                <div className="mb-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] leading-snug">
                      <span className="text-[#86868B] font-normal mr-2">{idx + 1}.</span>
                      {q.title}
                      {q.required && <span className="text-red-500 ml-1.5">*</span>}
                    </h2>
                  </div>
                  {q.description && (
                    <p className="text-xs sm:text-sm text-[#86868B] mt-1.5 leading-relaxed">
                      {q.description}
                    </p>
                  )}
                </div>

                {/* Question Type: Single Choice Radio */}
                {q.type === 'choice' && (
                  <div className="space-y-2.5">
                    {(q.options || []).map((opt, optIdx) => {
                      const isSelected = answers[q.id] === opt;
                      return (
                        <label
                          key={optIdx}
                          onClick={() => handleChoiceSelect(q.id, opt)}
                          className={`flex items-center gap-3.5 p-3.5 rounded-2xl border cursor-pointer select-none transition-all ${
                            isSelected
                              ? 'border-[#FF6600] bg-[#FF6600]/5 text-[#1D1D1F] font-medium'
                              : 'border-[#E5E5EA] hover:border-[#D2D2D7] hover:bg-[#F5F5F7] text-[#1D1D1F]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-[#FF6600] bg-[#FF6600]'
                                : 'border-[#D2D2D7] bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Question Type: Multiple Choice Checkboxes */}
                {q.type === 'multiple_choice' && (
                  <div className="space-y-2.5">
                    {(q.options || []).map((opt, optIdx) => {
                      const selectedList = answers[q.id] || [];
                      const isChecked = selectedList.includes(opt);
                      return (
                        <label
                          key={optIdx}
                          onClick={() => handleMultipleChoiceToggle(q.id, opt)}
                          className={`flex items-center gap-3.5 p-3.5 rounded-2xl border cursor-pointer select-none transition-all ${
                            isChecked
                              ? 'border-[#FF6600] bg-[#FF6600]/5 text-[#1D1D1F] font-medium'
                              : 'border-[#E5E5EA] hover:border-[#D2D2D7] hover:bg-[#F5F5F7] text-[#1D1D1F]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'border-[#FF6600] bg-[#FF6600] text-white'
                                : 'border-[#D2D2D7] bg-white'
                            }`}
                          >
                            {isChecked && (
                              <svg className="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Question Type: Rating 1 to 5 Stars */}
                {q.type === 'rating' && (
                  <div className="py-2">
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const currentVal = answers[q.id] || 0;
                        const isFilled = star <= currentVal;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleRatingSelect(q.id, star)}
                            className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border transition-all ${
                              isFilled
                                ? 'border-[#FF6600] bg-[#FF6600]/10 text-[#FF6600]'
                                : 'border-[#E5E5EA] hover:border-[#D2D2D7] hover:bg-[#F5F5F7] text-[#86868B]'
                            }`}
                          >
                            <Star
                              size={24}
                              weight={isFilled ? 'fill' : 'regular'}
                              className={isFilled ? 'text-[#FF6600]' : 'text-[#86868B]'}
                            />
                            <span className="text-[11px] font-semibold mt-0.5">{star}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Question Type: Short Text */}
                {q.type === 'text' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Type your response here..."
                      value={answers[q.id] || ''}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] placeholder-[#86868B] focus:bg-white focus:border-[#FF6600] focus:ring-1 focus:ring-[#FF6600] outline-none transition-all"
                    />
                  </div>
                )}

                {/* Question Type: Long Paragraph */}
                {q.type === 'long_text' && (
                  <div>
                    <textarea
                      rows={4}
                      placeholder="Type your detailed thoughts here..."
                      value={answers[q.id] || ''}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] placeholder-[#86868B] focus:bg-white focus:border-[#FF6600] focus:ring-1 focus:ring-[#FF6600] outline-none transition-all resize-y"
                    />
                  </div>
                )}

                {hasError && (
                  <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
                    <WarningCircle size={14} weight="bold" />
                    <span>{validationErrors[q.id]}</span>
                  </p>
                )}
              </div>
            );
          })}

          {/* Submit Action */}
          <div className="pt-4 flex items-center justify-between gap-4">
            <Link
              to="/"
              className="text-xs sm:text-sm text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#FF6600] hover:bg-[#E65C00] text-white font-medium text-sm transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <CircleNotch size={18} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Response</span>
                  <PaperPlaneRight size={16} weight="bold" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
