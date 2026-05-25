import { Activity, Thermometer, ShieldAlert, BookOpen, ArrowRight, MessageSquare, Camera, Users, Cloud, Droplet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../lib/LanguageContext.tsx";
import { useState, useEffect } from "react";
import { getDailyTip, type DailyTip } from "../lib/healthTips.ts";

const SLIDES = [
  {
    image: "/images/hero_healthcare_worker_1778968826302.png",
    titleKey: "home.hero.title",
    subtitleKey: "home.hero.subtitle"
  },
  {
    image: "/images/hero_prescription_scan_1778968842233.png",
    titleKey: "home.service.scan.title",
    subtitleKey: "home.service.scan.sub"
  },
  {
    image: "/images/hero_clinic_interior_1778968860846.png",
    titleKey: "home.service.doctors.title",
    subtitleKey: "home.service.doctors.sub"
  }
];

export function HomePage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { t, lang } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [tip, setTip] = useState<DailyTip | null>(null);
  const [tipLoading, setTipLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTipLoading(true);
    getDailyTip()
      .then((r) => { if (!cancelled) { setTip(r); setTipLoading(false); } })
      .catch(() => { if (!cancelled) setTipLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8 pb-12 lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-6">
      {/* Hero Section with Integrated Slider */}
      <section className="relative h-[520px] lg:h-[420px] bg-emerald-950 rounded-b-[3rem] lg:rounded-3xl overflow-hidden mx-0 shadow-2xl">
        {/* Background Images with Crossfade */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 z-0"
          >
            <img 
              src={SLIDES[currentSlide].image} 
              alt="Health Background"
              className="w-full h-full object-cover"
            />
            {/* Deep gradient for text legibility, softened */}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/40 to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Content Layer */}
        <div className="relative z-10 h-full flex flex-col justify-end p-8 pb-14 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${currentSlide}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              {/* Badge Moved Inline with the dynamic content - Softened appearance */}
              <div className="inline-flex items-center gap-2 bg-emerald-900/40 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-emerald-300 uppercase tracking-widest border border-white/5 shadow-sm">
                <ShieldAlert size={12} /> {t('home.hero.badge')}
              </div>

              <h2 className="text-4xl font-black text-white leading-tight tracking-tight">
                {t(SLIDES[currentSlide].titleKey)}
              </h2>
              <p className="text-emerald-100/70 text-sm leading-relaxed max-w-[300px] font-medium">
                {t(SLIDES[currentSlide].subtitleKey)}
              </p>
            </motion.div>
          </AnimatePresence>
          
          <div className="flex gap-3 items-center">
            <button 
              onClick={() => onNavigate('triage')}
              className="bg-emerald-500 text-white px-8 py-4 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              {t('home.hero.btn.triage')} <ArrowRight size={16} />
            </button>
            <button 
              onClick={() => onNavigate('scan')}
              className="bg-white/10 backdrop-blur-lg text-white px-6 py-4 rounded-2xl text-sm font-bold border border-white/20 active:scale-95 transition-all"
            >
              {t('home.hero.btn.scan')}
            </button>
          </div>
        </div>

        {/* Dots Indicators (Centered, subtle) */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${currentSlide === i ? 'w-6 bg-emerald-400' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
      </section>

      {/* Quick Stats/Alerts */}
      <div className="px-6 lg:px-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
          <Thermometer className="text-orange-600 mb-2" size={20} />
          <div className="text-[10px] text-orange-800 font-black uppercase tracking-wider mb-1">{t('home.stats.alert')}</div>
          <div className="text-sm font-bold text-orange-900">{t('home.stats.dengue')}</div>
          <div className="text-[10px] text-orange-700/70 mt-0.5">{t('home.stats.dengue_desc')}</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
          <Activity className="text-blue-600 mb-2" size={20} />
          <div className="text-[10px] text-blue-800 font-black uppercase tracking-wider mb-1">{t('home.stats.impact')}</div>
          <div className="text-sm font-bold text-blue-900">{t('home.stats.helped')}</div>
          <div className="text-[10px] text-blue-700/70 mt-0.5">{t('home.stats.helped_desc')}</div>
        </div>
      </div>

      {/* Core Features */}
      <section className="px-6 lg:px-0 space-y-4">
        <div className="flex items-end justify-between px-1">
          <h3 className="text-xl lg:text-2xl font-black text-gray-900">{t('home.services.title')}</h3>
          <span className="text-[10px] font-bold text-emerald-600">{t('home.services.view_all')}</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <FeatureCard
            icon={<MessageSquare size={24} />}
            title={t('home.service.triage.title')}
            subtitle={t('home.service.triage.sub')}
            color="emerald"
            onClick={() => onNavigate('triage')}
          />
          <FeatureCard
            icon={<Camera size={24} />}
            title={t('home.service.scan.title')}
            subtitle={t('home.service.scan.sub')}
            color="blue"
            onClick={() => onNavigate('scan')}
          />
          <FeatureCard
            icon={<Users size={24} />}
            title={t('home.service.doctors.title')}
            subtitle={t('home.service.doctors.sub')}
            color="purple"
            onClick={() => onNavigate('doctors')}
          />
        </div>
      </section>

      {/* How it Works / Mission */}
      <section className="px-6 lg:px-0">
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <BookOpen size={20} />
            </div>
            <h4 className="font-bold text-gray-900">{t('home.why.title')}</h4>
          </div>
          
          <div className="space-y-4">
            {[
              { titleKey: 'home.why.f1.title', descKey: 'home.why.f1.desc' },
              { titleKey: 'home.why.f2.title', descKey: 'home.why.f2.desc' },
              { titleKey: 'home.why.f3.title', descKey: 'home.why.f3.desc' },
              { titleKey: 'home.why.f4.title', descKey: 'home.why.f4.desc' },
              { titleKey: 'home.why.f5.title', descKey: 'home.why.f5.desc' },
            ].map((row, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-4 h-4 rounded-full bg-emerald-100 border-2 border-white shadow-sm shrink-0 mt-1" />
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong>{t(row.titleKey)}</strong> {t(row.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Health Tip (live, weather + profile aware) */}
      <section className="px-6 lg:px-0">
        <div className="p-5 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 relative overflow-hidden">
          <div className="relative z-10 flex items-start gap-4">
            <div className="p-2 bg-emerald-600 rounded-lg text-white shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-emerald-900 text-sm">{t('home.tip.title')}</h4>
                {tip?.weather && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Cloud size={10} /> {Math.round(tip.weather.temp)}°C
                    <Droplet size={10} className="ml-1" /> {Math.round(tip.weather.humidity)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
                {tipLoading
                  ? (lang === "bn" ? "আজকের টিপ লোড হচ্ছে..." : "Loading today's tip...")
                  : (tip ? (lang === "bn" ? tip.bn : tip.en) : t('home.tip.desc'))}
              </p>
              {tip && (
                <p className="text-[10px] text-emerald-700/60 mt-1.5 italic">{tip.source}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, subtitle, color, onClick }: any) {
  const colors: any = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
  };

  return (
    <motion.button 
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border ${colors[color]} text-left transition-all`}
    >
      <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-bold">{title}</div>
        <div className="text-xs opacity-70 font-medium">{subtitle}</div>
      </div>
      <ArrowRight size={18} className="opacity-50" />
    </motion.button>
  );
}
