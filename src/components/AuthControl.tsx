import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { useSurveyStore } from '../store/useSurveyStore';
import { OfflineManager } from './OfflineManager';
import { LogIn, LogOut, FolderOpen, Plus, Loader2, WifiOff, Trash2, Eye, EyeOff } from 'lucide-react';

export const AuthControl = () => {
  const { 
    user, 
    setUser, 
    savedSurveys, 
    loadSavedSurveys, 
    loadSurvey, 
    // saveCurrentSurvey, 
    createNewSurvey,
    createGroup,
    deleteSurvey,
    currentSurveyId,
    isSyncing
  } = useSurveyStore();
  
  const [showMenu, setShowMenu] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadSavedSurveys();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadSavedSurveys();
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, loadSavedSurveys]);

  const [isLoginView, setIsLoginView] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('demo@landscape360.app');
  const [password, setPassword] = useState('Demo12345!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isForgotPassword) {
        // Request password reset via email
        const subject = encodeURIComponent("Reset Password Request for Landscape360");
        const body = encodeURIComponent(
            `Dear Admin,\n\nI forgot my password and would like to request a password reset.\n\nMy Email: ${email.trim()}\n\nThank you.`
        );
        window.location.href = `mailto:contact@jcidigital.co.id?subject=${subject}&body=${body}`;

        setMessage({ type: 'success', text: 'Opening email client to send reset request...' });
      } else if (isLoginView) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        // Registration: Send request via email instead of direct signup
        const subject = encodeURIComponent("Request Account for Landscape360");
        const body = encodeURIComponent(
            `Dear Admin,\n\nI would like to request an account for the Landscape360 application.\n\nMy Email: ${email.trim()}\n\nThank you.`
        );
        window.location.href = `mailto:contact@jcidigital.co.id?subject=${subject}&body=${body}`;
        
        setMessage({ type: 'success', text: 'Opening email client to send request...' });
        // Optional: Switch back to login view or keep as is
      }
    } catch (err: any) {
      // Improve error message for common cases
      let errorMessage = err.message;
      if (err.message.includes('Invalid login credentials') && isLoginView) {
        errorMessage = 'Invalid credentials. Have you registered this account yet?';
      }
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowMenu(false);
  };

  // --- RENDER FOR GUEST (NOT LOGGED IN) ---
  if (!user) {
    return (
      <>
        <div className="relative w-full">
            <button
            onClick={() => setShowMenu(true)}
            className="cursor-pointer w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-600 hover:to-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 border border-blue-400/30 backdrop-blur-sm"
            >
            <LogIn size={14} />
            <span>Sign In / Register</span>
            </button>
        </div>

        {/* Full Screen Modal for Auth - Rendered via Portal */}
        {showMenu && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                <div 
                    className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Glow Decor */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

                    {/* Background Effects */}
                    <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>

                    <div className="p-8 relative z-10">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                                {isForgotPassword ? 'Reset Password' : (isLoginView ? 'Welcome Back' : 'Request Account')}
                            </h2>
                            <p className="text-sm text-gray-400 font-mono tracking-wide">
                                {isForgotPassword 
                                    ? 'REQUEST RESET VIA EMAIL' 
                                    : (isLoginView ? 'AUTHENTICATION REQUIRED' : 'SURVEYOR REGISTRATION')}
                            </p>
                        </div>

                        {/* Status Message */}
                        {message && (
                            <div className={`p-3 rounded-lg text-xs font-medium mb-6 flex items-start gap-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
                                {message.text}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleEmailAuth} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-1">Email Address</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/40 transition-all outline-none"
                                        required
                                        pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                                        title="Please enter a valid email address (e.g. name@company.com)"
                                    />
                                </div>
                            </div>
                            
                            {!isForgotPassword && (
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider ml-1">
                                        {isLoginView ? 'Password' : 'Password (Not Required)'}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-blue-400 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        </div>
                                        <input
                                             type={showPassword ? 'text' : 'password'}
                                             placeholder="••••••••"
                                             value={password}
                                             onChange={(e) => setPassword(e.target.value)}
                                             className={`w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-12 text-sm text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/40 transition-all outline-none ${!isLoginView ? 'opacity-50 cursor-not-allowed' : ''}`}
                                             required={isLoginView}
                                             disabled={!isLoginView}
                                             minLength={8}
                                             pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}"
                                             title="Must contain at least one number, one uppercase, one lowercase letter, one special symbol, and at least 8 or more characters"
                                         />
                                        {isLoginView && (
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-blue-400 transition-colors cursor-pointer"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="cursor-pointer w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        {isForgotPassword ? 'Request Reset' : (isLoginView ? 'Sign In' : 'Request Account')}
                                        {!loading && !isForgotPassword && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>}
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Footer Links */}
                        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-4 text-sm">
                            {!isForgotPassword && (
                                <p className="text-gray-400">
                                    {isLoginView ? "Don't have an account?" : "Already have an account? "}{" "}
                                    <button
                                        onClick={() => { setIsLoginView(!isLoginView); setMessage(null); }}
                                        className="cursor-pointer text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                                    >
                                        {isLoginView ? "Request Account" : "Sign In"}
                                    </button>
                                </p>
                            )}
                            
                            <button
                                onClick={() => {
                                    setIsForgotPassword(!isForgotPassword);
                                    setMessage(null);
                                }}
                                className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                {isForgotPassword ? "Back to Login" : "Forgot Password? (Request via Email)"}
                            </button>
                        </div>
                    </div>

                    {/* Close Button - Moved to bottom for better stacking */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                        }}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-[60] p-2 hover:bg-white/10 rounded-full cursor-pointer"
                        title="Close Modal"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>,
            document.body
        )}
      </>
    );
  }

  // --- RENDER FOR LOGGED IN USER ---
  // Cast user to any to avoid strict type checking issues with user_metadata in this context
  const currentUser = user as any;

  return (
    <div className="relative w-full">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors border border-blue-500/30"
      >
        {currentUser.user_metadata?.avatar_url ? (
            <img src={currentUser.user_metadata.avatar_url} className="w-4 h-4 rounded-full" alt="Avatar" />
        ) : (
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px]">
                {currentUser.email?.charAt(0).toUpperCase()}
            </div>
        )}
        <span className="max-w-[80px] truncate">{currentUser.user_metadata?.full_name || currentUser.email}</span>
        {isSyncing && <Loader2 size={12} className="animate-spin text-blue-400" />}
      </button>

       {/* Full Screen Modal for User Menu - Rendered via Portal */}
       {showMenu && createPortal(
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
               <div 
                   className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
                   onClick={(e) => e.stopPropagation()}
               >
                   <div className="p-6">
                       <div className="flex items-center gap-4 mb-6">
                           {currentUser.user_metadata?.avatar_url ? (
                               <img src={currentUser.user_metadata.avatar_url} className="w-16 h-16 rounded-full border-2 border-blue-500" alt="Avatar" />
                           ) : (
                               <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/30">
                                   {currentUser.email?.charAt(0).toUpperCase()}
                               </div>
                           )}
                           <div>
                               <h3 className="font-bold text-lg text-white">{currentUser.user_metadata?.full_name || 'Surveyor'}</h3>
                               <p className="text-xs text-gray-400">{currentUser.email}</p>
                               <div className="flex gap-2 mt-2">
                                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">Pro Plan</span>
                               </div>
                           </div>
                       </div>

                       {/* Quick Actions Grid */}
                       <div className="grid grid-cols-2 gap-3 mb-6">
                           <button 
                               onClick={() => { 
                                   createNewSurvey(); // Reset state for fresh survey
                                   createGroup(); // Start Navigator Mode (new survey group)
                                   setShowMenu(false); 
                               }}
                               className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group"
                           >
                               <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                   <Plus size={20} />
                               </div>
                               <span className="text-xs font-medium text-gray-300">New Survey</span>
                           </button>
                           <button 
                               onClick={() => { setShowOfflineManager(true); setShowMenu(false); }}
                               className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group"
                           >
                               <div className="p-2 bg-green-500/10 rounded-lg text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                   <WifiOff size={20} />
                               </div>
                               <span className="text-xs font-medium text-gray-300">Offline Map</span>
                           </button>
                       </div>

                       {/* Menu List */}
                       <div className="space-y-1 mb-6">
                           <div className="p-3">
                               <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                   <FolderOpen size={12} /> Recent Surveys
                               </div>
                               <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                   {savedSurveys.length === 0 ? (
                                       <p className="text-[10px] text-gray-600 italic">No saved surveys found</p>
                                   ) : (
                                       savedSurveys.map(survey => (
                                           <div
                                               key={survey.id}
                                               className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs group transition-colors ${currentSurveyId === survey.id ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20' : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'}`}
                                           >
                                               <button
                                                    onClick={() => { loadSurvey(survey.id); setShowMenu(false); }}
                                                    className="cursor-pointer flex-1 text-left truncate mr-2"
                                               >
                                                   <span className="block truncate">{survey.name}</span>
                                                   <span className="text-[9px] opacity-50 block">
                                                       {new Date(survey.updated_at).toLocaleDateString()}
                                                   </span>
                                               </button>
                                               
                                               <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmId(survey.id);
                                                    }}
                                                    className="cursor-pointer p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Survey"
                                               >
                                                    <Trash2 size={12} />
                                               </button>
                                           </div>
                                       ))
                                   )}
                               </div>
                           </div>
                       </div>

                       {/* Logout Button */}
                       <button
                           onClick={handleLogout}
                           className="cursor-pointer w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all font-medium text-sm"
                       >
                           <LogOut size={16} /> Sign Out
                       </button>
                   </div>

                   {/* Close Button - Moved to bottom for better stacking */}
                   <button 
                       onClick={(e) => {
                           e.stopPropagation();
                           setShowMenu(false);
                       }}
                       className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-[60] p-2 hover:bg-white/10 rounded-full cursor-pointer"
                       title="Close Menu"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                   </button>
               </div>
           </div>,
           document.body
       )}

      {showOfflineManager && createPortal(
        <OfflineManager onClose={() => setShowOfflineManager(false)} />,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div 
                className="relative w-full max-w-xs bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden p-6 animate-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Red Glow Decor */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                
                <div className="flex flex-col items-center text-center gap-5">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full"></div>
                        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-inner">
                            <Trash2 size={28} strokeWidth={1.5} />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">Hapus Survei?</h3>
                        <p className="text-xs text-gray-400 leading-relaxed px-2">
                            Tindakan ini tidak dapat dibatalkan. Semua data survei ini akan dihapus secara permanen dari perangkat dan cloud.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 w-full mt-2">
                        <button
                            onClick={() => {
                                if (deleteConfirmId) {
                                    deleteSurvey(deleteConfirmId);
                                    setDeleteConfirmId(null);
                                }
                            }}
                            className="cursor-pointer w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] border border-red-400/20"
                        >
                            Hapus Permanen
                        </button>
                        <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="cursor-pointer w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all active:scale-[0.98]"
                        >
                            Batalkan
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};
