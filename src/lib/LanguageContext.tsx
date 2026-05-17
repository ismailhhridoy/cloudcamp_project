import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'bn';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'app.nav.home': 'Home',
    'app.nav.triage': 'Advice',
    'app.nav.scan': 'Scan',
    'app.nav.doctors': 'Doctors',
    'app.nav.dashboard': 'Stats',
    'home.hero.badge': 'Live in 13,000 Villages',
    'home.hero.title': 'Your First Line of Care.',
    'home.hero.subtitle': 'ShasthyoAI brings doctor-level guidance to rural Bangladesh through voice-first AI.',
    'home.hero.btn.triage': 'Get Advice',
    'home.hero.btn.scan': 'Scan Meds',
    'home.stats.alert': 'Health Alert',
    'home.stats.dengue': 'Dengue Alert',
    'home.stats.dengue_desc': 'Khulna Division reports rise',
    'home.stats.impact': 'Impact Stats',
    'home.stats.helped': '12k+ Helped',
    'home.stats.helped_desc': 'Community verified reports',
    'home.services.title': 'Core Services',
    'home.services.view_all': 'View All',
    'home.service.triage.title': 'Health Advice',
    'home.service.triage.sub': 'Speak in Bangla, get expert advice',
    'home.service.scan.title': 'Prescription Reader',
    'home.service.scan.sub': 'Understand handwritten meds instantly',
    'home.service.doctors.title': 'Doctor Registry',
    'home.service.doctors.sub': 'Verify BMDC license & rate doctors',
    'home.why.title': 'Why ShasthyoAI?',
    'home.why.voice.title': 'Voice-First:',
    'home.why.voice.desc': 'Designed for those who cannot read or write, supporting regional dialects.',
    'home.why.offline.title': 'Offline-Ready:',
    'home.why.offline.desc': 'Core decision tree works even without internet connectivity.',
    'home.why.accountable.title': 'Accountable:',
    'home.why.accountable.desc': 'We bridge the gap between rural patients and the Health Ministry.',
    'home.tip.title': 'Health Tip of the Day',
    'home.tip.desc': '"Keep yourself hydrated! Drink safe, boiled water to prevent diarrheal diseases this summer."',
    'auth.prompt.title': 'Sign in to continue',
    'auth.prompt.desc': 'To save your history and sync across devices, please sign in.',
    'auth.btn.google': 'Sign in with Google',
    'auth.btn.skip': 'Continue as Guest',
    'scan.title': 'Scan Prescription',
    'scan.subtitle': 'Take a photo of your prescription or lab report',
    'scan.btn.select': 'Select/Take Photo',
    'scan.btn.analyze': 'Analyzing Handwriting...',
    'scan.btn.extract': 'Extract Details',
    'scan.result.doctor_detected': 'Doctor Detected',
    'scan.result.match': 'Match',
    'scan.result.meds_title': 'Medicines & Instructions',
    'scan.btn.save': 'Set Reminder Alarms',
    'triage.disclaimer': 'DISCLAIMER: This is an AI-assisted health advice tool for rural areas. It is NOT a substitute for professional medical advice.',
    'triage.welcome': 'Hello! I am ShasthyoAI. Please tell me your symptoms in Bangla or English.',
    'triage.placeholder': 'Type your symptoms...',
    'triage.thinking': 'ShasthyoAI is thinking...',
    'doctors.search.placeholder': 'Search by name, bmdc, or hospital...',
    'doctors.filter.nearby': 'Nearby',
    'doctors.filter.top': 'Top Rated',
    'doctors.filter.hospital': 'Hospital',
    'doctors.filter.specialist': 'Specialist',
    'doctors.found': 'Doctors Found',
    'doctors.btn.feedback': 'View Feedback',
    'doctors.btn.rate': 'Rate Experience',
  },
  bn: {
    'app.nav.home': 'হোম',
    'app.nav.triage': 'পরামর্শ',
    'app.nav.scan': 'স্ক্যান',
    'app.nav.doctors': 'ডাক্তার',
    'app.nav.dashboard': 'পরিসংখ্যান',
    'home.hero.badge': '১৩,০০০ গ্রামে সক্রিয়',
    'home.hero.title': 'আপনার চিকিৎসার প্রথম ধাপ।',
    'home.hero.subtitle': 'ভয়েস-ফার্স্ট এআই-এর মাধ্যমে গ্রামীণ বাংলাদেশে ডাক্তারের পরামর্শ পৌঁছে দিচ্ছে ShasthyoAI।',
    'home.hero.btn.triage': 'পরামর্শ নিন',
    'home.hero.btn.scan': 'ওষুধ স্ক্যান',
    'home.stats.alert': 'স্বাস্থ্য সতর্কতা',
    'home.stats.dengue': 'ডেঙ্গু সতর্কতা',
    'home.stats.dengue_desc': 'খুলনা বিভাগে সংক্রমণ বাড়ছে',
    'home.stats.impact': 'প্রভাব পরিসংখ্যান',
    'home.stats.helped': '১২ হাজার+ সাহায্যপ্রাপ্ত',
    'home.stats.helped_desc': 'কমিউনিটি ভেরিফাইড রিপোর্ট',
    'home.services.title': 'আমাদের সেবাসমূহ',
    'home.services.view_all': 'সব দেখুন',
    'home.service.triage.title': 'স্বাস্থ্য পরামর্শ',
    'home.service.triage.sub': 'বাংলায় কথা বলুন, বিশেষজ্ঞ পরামর্শ নিন',
    'home.service.scan.title': 'প্রেসক্রিপশন রিডার',
    'home.service.scan.sub': 'হাতের লেখা ওষুধ মুহূর্তেই বুঝুন',
    'home.service.doctors.title': 'ডাক্তার তালিকা',
    'home.service.doctors.sub': 'BMDC লাইসেন্স যাচাই করুন এবং রেটিং দিন',
    'home.why.title': 'কেন ShasthyoAI?',
    'home.why.voice.title': 'ভয়েস-ফার্স্ট:',
    'home.why.voice.desc': 'যারা পড়তে বা লিখতে পারেন না তাদের জন্য ডিজাইন করা হয়েছে।',
    'home.why.offline.title': 'অফলাইন-রেডি:',
    'home.why.offline.desc': 'ইন্টারনেট ছাড়াই ট্রায়াজ কাজ করে।',
    'home.why.accountable.title': 'জবাবদিহিতা:',
    'home.why.accountable.desc': 'আমরা রোগী এবং স্বাস্থ্য মন্ত্রণালয়ের মধ্যে সেতুবন্ধন তৈরি করি।',
    'home.tip.title': 'আজকের স্বাস্থ্য টিপ',
    'home.tip.desc': '"নিজেকে হাইড্রেটেড রাখুন! এই গরমে ডায়রিয়া প্রতিরোধে নিরাপদ জল পান করুন।।',
    'auth.prompt.title': 'চালিয়ে যেতে সাইন ইন করুন',
    'auth.prompt.desc': 'আপনার হিস্ট্রি সংরক্ষণ করতে এবং সিঙ্ক করতে গুগল দিয়ে লগইন করুন।',
    'auth.btn.google': 'গুগল দিয়ে সাইন ইন',
    'auth.btn.skip': 'অতিথি হিসেবে চালিয়ে যান',
    'scan.title': 'প্রেসক্রিপশন স্ক্যান',
    'scan.subtitle': 'আপনার প্রেসক্রিপশনের ছবি তুলুন বা আপলোড করুন',
    'scan.btn.select': 'ছবি তুলুন/বাছাই করুন',
    'scan.btn.analyze': 'বিশ্লেষণ করা হচ্ছে...',
    'scan.btn.extract': 'তথ্য বের করুন',
    'scan.result.doctor_detected': 'ডাক্তার শনাক্ত করা হয়েছে',
    'scan.result.match': 'ম্যাচ',
    'scan.result.meds_title': 'ওষুধ এবং নির্দেশনা',
    'scan.btn.save': 'ওষুধের রিমাইন্ডার সেট করুন',
    'triage.disclaimer': 'সতর্কবার্তা: এটি একটি এআই স্বাস্থ্য পরামর্শ টুল। এটি পেশাদার চিকিৎসার বিকল্প নয়।',
    'triage.welcome': 'হ্যালো! আমি ShasthyoAI। আপনার সমস্যার কথা বাংলায় বা ইংরেজিতে বলুন।',
    'triage.placeholder': 'আপনার সমস্যা লিখুন...',
    'triage.thinking': 'ShasthyoAI ভাবছে...',
    'doctors.search.placeholder': 'নাম, BMDC বা হাসপাতাল দিয়ে খুঁজুন...',
    'doctors.filter.nearby': 'কাছাকাছি',
    'doctors.filter.top': 'শীর্ষ রেটেড',
    'doctors.filter.hospital': 'হাসপাতাল',
    'doctors.filter.specialist': 'বিশেষজ্ঞ',
    'doctors.found': 'জন ডাক্তার পাওয়া গেছে',
    'doctors.btn.feedback': 'ফিডব্যাক দেখুন',
    'doctors.btn.rate': 'রেটিং দিন',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('bn');

  const t = (key: string) => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
